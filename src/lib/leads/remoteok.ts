import type { RawLead } from "./types";

interface RemoteOKJob {
  id?: string;
  slug?: string;
  url?: string;
  position?: string;
  company?: string;
  location?: string;
  description?: string;
  date?: string;
  epoch?: number;
  tags?: string[];
}

/** Fetch remote job listings from RemoteOK public API. */
export async function fetchRemoteOKLeads(): Promise<RawLead[]> {
  const res = await fetch("https://remoteok.com/api", {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "CurioStudio/1.0 (job tracker)",
    },
  });

  if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);

  const data = (await res.json()) as RemoteOKJob[];
  const jobs = Array.isArray(data) ? data.slice(1) : [];

  return jobs
    .filter((j) => j.position && (j.url || j.slug))
    .slice(0, 50)
    .map((j) => ({
      title: j.position!,
      url: j.url ?? `https://remoteok.com/remote-jobs/${j.slug ?? j.id}`,
      source: "REMOTEOK" as const,
      companyName: j.company ?? undefined,
      location: j.location ?? undefined,
      remote: true,
      postedAt: j.epoch
        ? new Date(j.epoch * 1000)
        : j.date
          ? new Date(j.date)
          : undefined,
      description: typeof j.description === "string" ? j.description.slice(0, 2000) : undefined,
    }));
}
