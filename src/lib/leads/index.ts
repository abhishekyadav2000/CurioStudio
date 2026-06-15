import { prisma } from "@/lib/db";
import type { LeadSource } from "@prisma/client";
import { fetchHackerNewsLeads } from "./hackernews";
import { fetchRemoteOKLeads } from "./remoteok";
import { fetchGitHubSearchLeads, fetchGitHubOrgLeads } from "./github";
import { fetchATSLeads } from "./ats";
import {
  fetchFortuneCareers,
  FORTUNE_COMPANIES,
  fortuneCompanyToMeta,
  FORTUNE_COMPANY_NAMES,
} from "./fortune-careers";
import { fetchWellfoundLeads } from "./wellfound";
import { fetchWWRLeads } from "./wwr";
import { fetchBuiltInLeads } from "./builtin";
import { fetchIndeedLeads } from "./indeed";
import { fetchLinkedInLeads } from "./linkedin";
import { enrichCompany } from "./enrich";
import { pruneStaleLeads } from "./prune";
import {
  applySourceCap,
  normalizeDedupeKey,
  validateAndSanitizeLead,
} from "./quality";
import { parsePreferences, scoreLead, type JobPreferences } from "./scoring";
import type { RawLead } from "./types";
import type { CompanyMeta } from "./types";

export type { RawLead } from "./types";
export type { JobPreferences } from "./scoring";
export { fetchHackerNewsLeads } from "./hackernews";
export { fetchRemoteOKLeads } from "./remoteok";
export { fetchGitHubSearchLeads, fetchGitHubOrgLeads } from "./github";
export { fetchGreenhouseBoard, fetchLeverBoard, fetchATSLeads } from "./ats";
export { fetchFortuneCareers, FORTUNE_COMPANIES, getFortuneCompanyCount, FORTUNE_COMPANY_NAMES } from "./fortune-careers";
export { enrichCompany, enrichAllCompanies } from "./enrich";
export { findContacts, parseJobRequirements } from "./contacts";
export { researchLead } from "./research";
export { generateOutreachDraft } from "./outreach";
export { parsePreferences, scoreLead, DEFAULT_PREFERENCES, ROLE_PRESETS } from "./scoring";
export { pruneStaleLeads } from "./prune";
export { verifyJobLead, verifyJobLeads } from "./verify-posting";
export { discoverTeam, discoverTeamsForRecentCompanies } from "./team-discovery";
export {
  createOutreachBatch,
  listOutreachBatches,
  getOutreachBatch,
  updateOutreachBatch,
  linkBatchToProject,
  createContentProjectForBatch,
} from "./outreach-batch";

export interface ScanSettings {
  leadsAutoScanIntervalMinutes: number;
  leadsMaxAgeDays: number;
  leadsAutoScanEnabled: boolean;
  lastLeadsScanAt: Date | null;
}

export async function getScanSettings(): Promise<ScanSettings> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return {
    leadsAutoScanIntervalMinutes: settings?.leadsAutoScanIntervalMinutes ?? 5,
    leadsMaxAgeDays: settings?.leadsMaxAgeDays ?? 45,
    leadsAutoScanEnabled: settings?.leadsAutoScanEnabled ?? true,
    lastLeadsScanAt: settings?.lastLeadsScanAt ?? null,
  };
}

export async function getJobPreferences(): Promise<JobPreferences> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return parsePreferences(settings?.jobPreferences);
}

export async function saveJobPreferences(prefs: JobPreferences): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", jobPreferences: JSON.stringify({ ...prefs, preferencesSet: true }) },
    update: { jobPreferences: JSON.stringify({ ...prefs, preferencesSet: true }) },
  });
}

export async function rescoreAllOpenLeads(preferences?: JobPreferences): Promise<number> {
  const prefs = preferences ?? (await getJobPreferences());
  const leads = await prisma.jobLead.findMany({
    where: { status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] } },
  });
  let updated = 0;
  for (const lead of leads) {
    const relevanceScore = scoreLead(lead, prefs);
    if (relevanceScore !== lead.relevanceScore) {
      await prisma.jobLead.update({ where: { id: lead.id }, data: { relevanceScore } });
      updated++;
    }
  }
  return updated;
}

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
export async function fetchAllRawLeads(maxAgeDays = 45): Promise<{ leads: RawLead[]; errors: string[] }> {
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
    { name: "Fortune Careers", fn: () => fetchFortuneCareers(maxAgeDays) },
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

  const { kept, capped } = applySourceCap(all);

  const seen = new Set<string>();
  const leads = kept.filter((lead) => {
    const urlKey = lead.url.toLowerCase().trim();
    const dedupeKey = normalizeDedupeKey(lead.companyName, lead.title);
    if (seen.has(urlKey) || seen.has(dedupeKey)) return false;
    seen.add(urlKey);
    seen.add(dedupeKey);
    return true;
  });

  if (capped > 0) {
    console.log(`[leads] Capped ${capped} excess leads per source limits`);
  }

  return { leads, errors };
}

export interface ScanResult {
  added: number;
  skipped: number;
  rejected: number;
  pruned: number;
  rescored: number;
  verified: number;
  deadLinks: number;
  archivedDead: number;
  total: number;
  bySource: Record<string, number>;
  lastScanAt: Date;
  errors: string[];
  fortuneCompaniesTracked: number;
  message: string;
}

/** Pull latest leads, apply quality gates, prune stale, score relevance. */
export async function fetchAllLeads(): Promise<ScanResult> {
  const settings = await getScanSettings();
  const preferences = await getJobPreferences();
  const maxAgeDays = settings.leadsMaxAgeDays;

  const { leads: raw, errors } = await fetchAllRawLeads(maxAgeDays);
  const bySource: Record<string, number> = {};
  let added = 0;
  let skipped = 0;
  let rejected = 0;

  for (const lead of raw) {
    bySource[lead.source] = (bySource[lead.source] ?? 0) + 1;

    const sanitized = validateAndSanitizeLead(lead, maxAgeDays);
    if (!sanitized) {
      rejected++;
      continue;
    }

    const normalizedKey = normalizeDedupeKey(sanitized.companyName, sanitized.title);

    const existingByUrl = await prisma.jobLead.findUnique({ where: { url: sanitized.url } });
    if (existingByUrl) {
      skipped++;
      continue;
    }

    const existingByKey = await prisma.jobLead.findFirst({
      where: { normalizedKey, status: { not: "ARCHIVED" } },
    });
    if (existingByKey) {
      skipped++;
      continue;
    }

    let companyId: string | null = null;
    if (sanitized.companyName) {
      companyId = await upsertCompanyFromLead(sanitized.companyName, sanitized.companyMeta);
    }

    const isFortune100 = sanitized.companyName
      ? FORTUNE_COMPANY_NAMES.has(sanitized.companyName)
      : false;

    const relevanceScore = scoreLead(
      {
        title: sanitized.title,
        description: sanitized.description ?? null,
        companyName: sanitized.companyName ?? null,
        location: sanitized.location ?? null,
        remote: sanitized.remote ?? null,
        postedAt: sanitized.postedAt ?? null,
        capturedAt: new Date(),
        isFortune100,
      },
      preferences
    );

    await prisma.jobLead.create({
      data: {
        title: sanitized.title,
        url: sanitized.url,
        normalizedKey,
        source: sanitized.source,
        companyId,
        companyName: sanitized.companyName,
        location: sanitized.location,
        remote: sanitized.remote,
        postedAt: sanitized.postedAt,
        actualPostedAt: sanitized.postedAt,
        description: sanitized.description,
        relevanceScore,
        isFortune100,
        status: "NEW",
      },
    });
    added++;

    // Verify newly added lead in background (best-effort)
    try {
      const created = await prisma.jobLead.findUnique({ where: { url: sanitized.url } });
      if (created) {
        const { verifyJobLead } = await import("./verify-posting");
        await verifyJobLead(created.id);
      }
    } catch {
      // non-blocking
    }
  }

  const pruneResult = await pruneStaleLeads(maxAgeDays);
  const rescored = await rescoreAllOpenLeads(preferences);

  // Verify new and recent leads; archive dead links
  const { verifyJobLeads } = await import("./verify-posting");
  const verifyResult = await verifyJobLeads(undefined, 30);

  const { discoverTeamsForRecentCompanies } = await import("./team-discovery");
  try {
    await discoverTeamsForRecentCompanies(3);
  } catch (err) {
    console.error("[leads] team discovery:", err);
  }

  const lastScanAt = new Date();
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      lastLeadsScanAt: lastScanAt,
      leadsAutoScanIntervalMinutes: 5,
      leadsMaxAgeDays: maxAgeDays,
    },
    update: { lastLeadsScanAt: lastScanAt },
  });

  for (const co of await prisma.company.findMany()) {
    await prisma.company.update({
      where: { id: co.id },
      data: { lastCheckedAt: lastScanAt },
    });
  }

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

  const message = `Added ${added} fresh · Pruned ${pruneResult.archived} stale · Verified ${verifyResult.verified} (${verifyResult.dead} dead) · Skipped ${skipped + rejected} low-quality`;

  return {
    added,
    skipped,
    rejected,
    pruned: pruneResult.archived,
    rescored,
    verified: verifyResult.verified,
    deadLinks: verifyResult.dead,
    archivedDead: verifyResult.archived,
    total: raw.length,
    bySource,
    lastScanAt,
    errors,
    fortuneCompaniesTracked: FORTUNE_COMPANIES.length,
    message,
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
