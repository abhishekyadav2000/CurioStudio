import { prisma } from "@/lib/db";
import type { LeadSource } from "@prisma/client";
import { fetchHackerNewsLeads } from "./hackernews";
import { fetchRemoteOKLeads } from "./remoteok";
import { fetchGitHubSearchLeads, fetchGitHubOrgLeads } from "./github";
import { fetchATSLeads } from "./ats";
import type { RawLead } from "./types";

export type { RawLead } from "./types";
export { fetchHackerNewsLeads } from "./hackernews";
export { fetchRemoteOKLeads } from "./remoteok";
export { fetchGitHubSearchLeads, fetchGitHubOrgLeads } from "./github";
export { fetchGreenhouseBoard, fetchLeverBoard, fetchATSLeads } from "./ats";
export { enrichCompany, enrichAllCompanies } from "./enrich";
export { findContacts, parseJobRequirements } from "./contacts";
export { researchLead } from "./research";
export { generateOutreachDraft } from "./outreach";

async function findOrCreateCompany(name: string): Promise<string | null> {
  if (!name?.trim()) return null;
  const trimmed = name.trim();
  const existing = await prisma.company.findUnique({ where: { name: trimmed } });
  if (existing) return existing.id;
  const created = await prisma.company.create({ data: { name: trimmed } });
  return created.id;
}

/** Fetch from all sources in parallel; failures are logged, not thrown. */
export async function fetchAllRawLeads(): Promise<{ leads: RawLead[]; errors: string[] }> {
  const companies = await prisma.company.findMany({
    where: {
      OR: [{ githubOrg: { not: null } }, { greenhouseSlug: { not: null } }, { leverSlug: { not: null } }],
    },
  });

  const orgs = companies
    .filter((c) => c.githubOrg)
    .map((c) => ({ name: c.name, githubOrg: c.githubOrg! }));

  const fetchers: { name: string; fn: () => Promise<RawLead[]> }[] = [
    { name: "Hacker News", fn: fetchHackerNewsLeads },
    { name: "RemoteOK", fn: fetchRemoteOKLeads },
    { name: "GitHub Search", fn: fetchGitHubSearchLeads },
    ...(orgs.length ? [{ name: "GitHub Orgs", fn: () => fetchGitHubOrgLeads(orgs) }] : []),
    { name: "ATS Boards", fn: () => fetchATSLeads(companies) },
  ];

  const all: RawLead[] = [];
  const errors: string[] = [];

  const results = await Promise.allSettled(fetchers.map((f) => f.fn()));
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push(`${fetchers[i].name}: ${msg}`);
      console.error(`[leads] ${fetchers[i].name} error:`, r.reason);
    }
  }

  const seen = new Set<string>();
  const leads = all.filter((lead) => {
    const key = lead.url.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { leads, errors };
}

export interface ScanResult {
  added: number;
  skipped: number;
  total: number;
  bySource: Record<string, number>;
  lastScanAt: Date;
  errors: string[];
}

/** Pull latest leads from all sources, dedupe by URL, store new ones as NEW. */
export async function fetchAllLeads(): Promise<ScanResult> {
  const { leads: raw, errors } = await fetchAllRawLeads();
  const bySource: Record<string, number> = {};
  let added = 0;
  let skipped = 0;

  for (const lead of raw) {
    bySource[lead.source] = (bySource[lead.source] ?? 0) + 1;

    const existing = await prisma.jobLead.findUnique({ where: { url: lead.url } });
    if (existing) {
      skipped++;
      continue;
    }

    let companyId: string | null = null;
    if (lead.companyName) {
      companyId = await findOrCreateCompany(lead.companyName);
    }

    await prisma.jobLead.create({
      data: {
        title: lead.title,
        url: lead.url,
        source: lead.source,
        companyId,
        companyName: lead.companyName,
        location: lead.location,
        remote: lead.remote,
        postedAt: lead.postedAt,
        description: lead.description,
        status: "NEW",
      },
    });
    added++;
  }

  const lastScanAt = new Date();
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", lastLeadsScanAt: lastScanAt },
    update: { lastLeadsScanAt: lastScanAt },
  });

  for (const co of await prisma.company.findMany()) {
    await prisma.company.update({
      where: { id: co.id },
      data: { lastCheckedAt: lastScanAt },
    });
  }

  return { added, skipped, total: raw.length, bySource, lastScanAt, errors };
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  HN: "Hacker News",
  REMOTEOK: "RemoteOK",
  GREENHOUSE: "Greenhouse / Lever",
  GITHUB: "GitHub",
  MANUAL: "Manual",
};
