import type { JobLead } from "@prisma/client";
import { FORTUNE_COMPANY_NAMES } from "./fortune-careers";

export interface JobPreferences {
  targetRoles: string[];
  keywords: string[];
  locations: string[];
  remoteOnly: boolean;
  minSalary?: number;
  excludeCompanies: string[];
  preferencesSet?: boolean;
}

export const DEFAULT_PREFERENCES: JobPreferences = {
  targetRoles: [],
  keywords: [],
  locations: [],
  remoteOnly: false,
  excludeCompanies: [],
  preferencesSet: false,
};

export const ROLE_PRESETS = [
  "Software Engineer",
  "ML Engineer",
  "DevRel",
  "Product Manager",
  "Data Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Staff Engineer",
  "Engineering Manager",
] as const;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(normalize(b).split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

function recencyBonus(postedAt?: Date | null, capturedAt?: Date): number {
  const ref = postedAt ?? capturedAt ?? new Date();
  const days = (Date.now() - ref.getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 3) return 20;
  if (days <= 7) return 15;
  if (days <= 14) return 10;
  if (days <= 30) return 5;
  if (days <= 45) return 2;
  return 0;
}

function companyTierBonus(companyName?: string | null, isFortune100?: boolean): number {
  if (isFortune100) return 15;
  if (companyName && FORTUNE_COMPANY_NAMES.has(companyName)) return 15;
  return 0;
}

/** Score a job lead 0–100 against user preferences. */
export function scoreLead(
  lead: Pick<
    JobLead,
    "title" | "description" | "companyName" | "location" | "remote" | "postedAt" | "capturedAt" | "isFortune100"
  >,
  preferences: JobPreferences = DEFAULT_PREFERENCES
): number {
  let score = 0;

  // Title / role match (0–35)
  if (preferences.targetRoles.length > 0) {
    let bestRole = 0;
    for (const role of preferences.targetRoles) {
      bestRole = Math.max(bestRole, wordOverlap(lead.title, role));
    }
    score += Math.round(bestRole * 35);
  } else {
    score += 10; // neutral baseline when no roles set
  }

  // Keyword overlap in title + description (0–30)
  if (preferences.keywords.length > 0) {
    const haystack = `${lead.title} ${lead.description ?? ""}`;
    let hits = 0;
    for (const kw of preferences.keywords) {
      if (normalize(haystack).includes(normalize(kw))) hits++;
    }
    score += Math.min(30, Math.round((hits / preferences.keywords.length) * 30));
  }

  // Location / remote (0–10)
  if (preferences.remoteOnly && lead.remote) score += 10;
  else if (preferences.locations.length > 0 && lead.location) {
    const loc = normalize(lead.location);
    if (preferences.locations.some((l) => loc.includes(normalize(l)))) score += 10;
  } else if (!preferences.remoteOnly) {
    score += 3;
  }

  // Recency (0–20)
  score += recencyBonus(lead.postedAt, lead.capturedAt);

  // Company tier (0–15)
  score += companyTierBonus(lead.companyName, lead.isFortune100);

  // Exclude companies penalty
  if (
    lead.companyName &&
    preferences.excludeCompanies.some((c) => normalize(c) === normalize(lead.companyName!))
  ) {
    score = Math.max(0, score - 50);
  }

  return Math.min(100, Math.max(0, score));
}

export function parsePreferences(raw?: string | null): JobPreferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw) as Partial<JobPreferences>;
    return {
      targetRoles: parsed.targetRoles ?? [],
      keywords: parsed.keywords ?? [],
      locations: parsed.locations ?? [],
      remoteOnly: parsed.remoteOnly ?? false,
      minSalary: parsed.minSalary,
      excludeCompanies: parsed.excludeCompanies ?? [],
      preferencesSet: parsed.preferencesSet ?? false,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
