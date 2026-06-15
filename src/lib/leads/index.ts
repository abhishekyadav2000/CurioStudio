import { prisma } from "@/lib/db";
import type { LeadSource } from "@prisma/client";
import { fetchHackerNewsLeads } from "./hackernews";
import { fetchRemoteOKLeads } from "./remoteok";
import { fetchGitHubSearchLeads, fetchGitHubOrgLeads } from "./github";
import { fetchATSLeads } from "./ats";
import { fetchFortuneCareers, FORTUNE_COMPANIES, fortuneCompanyToMeta } from "./fortune-careers";
import { fetchWellfoundLeads } from "./wellfound";
import { fetchWWRLeads } from "./wwr";
import { fetchBuiltInLeads } from "./builtin";
import { fetchIndeedLeads } from "./indeed";
import { fetchLinkedInLeads } from "./linkedin";
import { enrichCompany } from "./enrich";
import type { RawLead } from "./types";
import type { CompanyMeta } from "./types";

export type { RawLead } from "./types";
export { fetchHackerNewsLeads } from "./hackernews";
export { fetchRemoteOKLeads } from "./remoteok";
export { fetchGitHubSearchLeads, fetchGitHubOrgLeads } from "./github";
export { fetchGreenhouseBoard, fetchLeverBoard, fetchATSLeads } from "./ats";
export { fetchFortuneCareers, FORTUNE_COMPANIES, getFortuneCompanyCount } from "./fortune-careers";
export { enrichCompany, enrichAllCompanies } from "./enrich";
export { findContacts, parseJobRequirements } from "./contacts";
export { researchLead } from "./research";
export { generateOutreachDraft } from "./outreach";

async function upsertCompanyFromLead(name: string, meta?: CompanyMeta): Promise<string> {
  const trimmed = name.trim();
  const existing = await prisma.company.findUnique({ where: { name: trimmed } });

  const data = {
    careersUrl: meta?.careersUrl ?? existing?.careersUrl,
    atsType: meta?.atsType ?? existing?.atsType,
    linkedinSearchUrl: meta?.linkedinSearchUrl ?? existing?.linkedinSearchUrl,
    greenhouseSlug: meta?.greenhouseSlug ?? existing?.greenhouseSlug,
    leverSlug: meta?.leverSlug ?? existing?.leverSlug,
    ashbySlug: meta?.ashbySlug ?? existing?.ashbySlug,
    githubOrg: meta?.githubOrg ?? existing?.githubOrg,
    website: meta?.website ?? existing?.website,
  };

  if (existing) {
    await prisma.company.update({ where: { id: existing.id }, data });
    return existing.id;
  }

  const created = await prisma.company.create({
    data: { name: trimmed, ...data },
  });
  return created.id;
}

/** Seed/update all Fortune-tracked companies in the database. */
export async function ensureFortuneCompanies(): Promise<number> {
  let count = 0;
  for (const co of FORTUNE_COMPANIES) {
    await upsertCompanyFromLead(co.name, fortuneCompanyToMeta(co));
    count++;
  }
  return count;
}

/** Fetch from all sources in parallel; failures are logged, not thrown. */
export async function fetchAllRawLeads(): Promise<{ leads: RawLead[]; errors: string[] }> {
  await ensureFortuneCompanies();

  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { githubOrg: { not: null } },
        { greenhouseSlug: { not: null } },
        { leverSlug: { not: null } },
        { ashbySlug: { not: null } },
      ],
    },
  });

  const orgs = companies
    .filter((c) => c.githubOrg)
    .map((c) => ({ name: c.name, githubOrg: c.githubOrg! }));

  const fetchers: { name: string; fn: () => Promise<RawLead[]> }[] = [
    { name: "Fortune Careers", fn: fetchFortuneCareers },
    { name: "Hacker News", fn: fetchHackerNewsLeads },
    { name: "RemoteOK", fn: fetchRemoteOKLeads },
    { name: "We Work Remotely", fn: fetchWWRLeads },
    { name: "Indeed", fn: fetchIndeedLeads },
    { name: "LinkedIn", fn: fetchLinkedInLeads },
    { name: "Wellfound", fn: fetchWellfoundLeads },
    { name: "Built In", fn: fetchBuiltInLeads },
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
  fortuneCompaniesTracked: number;
}

/** Pull latest leads from all sources, dedupe by URL, store new ones as NEW. */
export async function fetchAllLeads(): Promise<ScanResult> {
  const { leads: raw, errors } = await fetchAllRawLeads();
  const bySource: Record<string, number> = {};
  let added = 0;
  let skipped = 0;
  const newCompanyIds = new Set<string>();

  for (const lead of raw) {
    bySource[lead.source] = (bySource[lead.source] ?? 0) + 1;

    const existing = await prisma.jobLead.findUnique({ where: { url: lead.url } });
    if (existing) {
      skipped++;
      continue;
    }

    let companyId: string | null = null;
    if (lead.companyName) {
      companyId = await upsertCompanyFromLead(lead.companyName, lead.companyMeta);
      if (lead.companyMeta?.careersUrl) newCompanyIds.add(companyId);
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

  // Enrich up to 5 Fortune companies that lack enrichment (contact discovery)
  const toEnrich = await prisma.company.findMany({
    where: { careersUrl: { not: null }, lastEnrichedAt: null },
    take: 5,
  });
  for (const co of toEnrich) {
    try {
      await enrichCompany(co.id);
    } catch (err) {
      console.error(`[leads] enrich ${co.name}:`, err);
    }
  }

  return {
    added,
    skipped,
    total: raw.length,
    bySource,
    lastScanAt,
    errors,
    fortuneCompaniesTracked: FORTUNE_COMPANIES.length,
  };
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  HN: "Hacker News",
  REMOTEOK: "RemoteOK",
  GREENHOUSE: "Greenhouse",
  GITHUB: "GitHub",
  MANUAL: "Manual",
  FORTUNE_CAREERS: "Fortune / Top Cos",
  WELLFOUND: "Wellfound",
  WWR: "We Work Remotely",
  BUILTIN: "Built In",
  INDEED: "Indeed",
  LINKEDIN: "LinkedIn",
  ASHBY: "Ashby",
  LEVER: "Lever",
};
