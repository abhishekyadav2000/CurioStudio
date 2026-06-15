import type { RawLead } from "./types";

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  location?: string;
  isRemote?: boolean;
  publishedAt?: string;
  descriptionPlain?: string;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

/** Fetch jobs from a public Ashby job board. */
export async function fetchAshbyBoard(slug: string, companyName?: string): Promise<RawLead[]> {
  const res = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
    { cache: "no-store", headers: { Accept: "application/json" } }
  );

  if (!res.ok) return [];

  const data = (await res.json()) as AshbyResponse;

  return (data.jobs ?? []).map((job) => ({
    title: job.title,
    url: job.jobUrl,
    source: "ASHBY" as const,
    companyName: companyName ?? slug,
    location: job.location,
    remote: job.isRemote ?? /remote/i.test(job.location ?? ""),
    postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
    description: job.descriptionPlain?.slice(0, 2000),
  }));
}
