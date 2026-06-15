import type { RawLead } from "./types";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name: string };
  updated_at?: string;
  content?: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: { location?: string; team?: string; commitment?: string };
  createdAt?: number;
  descriptionPlain?: string;
}

/** Fetch jobs from a Greenhouse public board. */
export async function fetchGreenhouseBoard(slug: string, companyName?: string): Promise<RawLead[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as GreenhouseResponse;

  return (data.jobs ?? []).map((job) => ({
    title: job.title,
    url: job.absolute_url,
    source: "GREENHOUSE" as const,
    companyName: companyName ?? slug,
    location: job.location?.name,
    remote: /remote/i.test(job.location?.name ?? ""),
    postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
    description: job.content?.replace(/<[^>]+>/g, " ").slice(0, 2000),
  }));
}

/** Fetch jobs from a Lever public board. */
export async function fetchLeverBoard(slug: string, companyName?: string): Promise<RawLead[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const postings = (await res.json()) as LeverPosting[];

  return (postings ?? []).map((p) => ({
    title: p.text,
    url: p.hostedUrl,
    source: "GREENHOUSE" as const,
    companyName: companyName ?? slug,
    location: p.categories?.location,
    remote: /remote/i.test(p.categories?.location ?? p.categories?.commitment ?? ""),
    postedAt: p.createdAt ? new Date(p.createdAt) : undefined,
    description: p.descriptionPlain?.slice(0, 2000),
  }));
}

/** Fetch all ATS board jobs for watched companies. */
export async function fetchATSLeads(
  companies: { name: string; greenhouseSlug?: string | null; leverSlug?: string | null }[]
): Promise<RawLead[]> {
  const leads: RawLead[] = [];

  for (const co of companies) {
    if (co.greenhouseSlug) {
      const gh = await fetchGreenhouseBoard(co.greenhouseSlug, co.name);
      leads.push(...gh);
    }
    if (co.leverSlug) {
      const lv = await fetchLeverBoard(co.leverSlug, co.name);
      leads.push(...lv);
    }
  }

  return leads;
}
