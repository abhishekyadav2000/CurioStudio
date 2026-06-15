import type { RawLead } from "./types";

const MAX_DESCRIPTION_LENGTH = 8000;
const MAX_TITLE_LENGTH = 300;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const ALLOWED_URL_PROTOCOLS = ["https:"];

/** Strip scripts, event handlers, and limit HTML description length. */
export function sanitizeDescription(html?: string | null): string | undefined {
  if (!html) return undefined;
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "");
  if (clean.length > MAX_DESCRIPTION_LENGTH) {
    clean = clean.slice(0, MAX_DESCRIPTION_LENGTH) + "…";
  }
  return clean.trim() || undefined;
}

/** Validate external URLs — https only, no localhost/private IPs. */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (!ALLOWED_URL_PROTOCOLS.includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.")) {
      return false;
    }
    if (host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeDedupeKey(companyName?: string | null, title?: string): string {
  const co = (companyName ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const t = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${co}::${t}`;
}

export function isPostedTooOld(postedAt?: Date | null, maxAgeDays = 45): boolean {
  if (!postedAt) return false;
  const ageMs = Date.now() - postedAt.getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

export function isPostedOverOneYear(postedAt?: Date): boolean {
  if (!postedAt) return false;
  return Date.now() - postedAt.getTime() > ONE_YEAR_MS;
}

export interface QualityRejectReason {
  reason: string;
  lead: RawLead;
}

/** Validate and sanitize a raw lead at ingest. Returns null if rejected. */
export function validateAndSanitizeLead(
  lead: RawLead,
  maxAgeDays = 45
): RawLead | null {
  const title = lead.title?.trim();
  if (!title || title.length < 3) return null;
  if (!lead.url?.trim() || !isAllowedUrl(lead.url)) return null;

  if (lead.postedAt && isPostedOverOneYear(lead.postedAt)) return null;
  if (lead.postedAt && isPostedTooOld(lead.postedAt, maxAgeDays)) return null;

  return {
    ...lead,
    title: title.slice(0, MAX_TITLE_LENGTH),
    url: lead.url.trim(),
    description: sanitizeDescription(lead.description),
    companyName: lead.companyName?.trim().slice(0, 200),
  };
}

/** Per-source caps to avoid quantity dumps. */
export const SOURCE_SCAN_CAPS: Partial<Record<string, number>> = {
  FORTUNE_CAREERS: 200,
  LINKEDIN: 50,
  INDEED: 50,
  REMOTEOK: 40,
  WELLFOUND: 40,
  WWR: 30,
  BUILTIN: 30,
  HN: 25,
  GITHUB: 30,
  GREENHOUSE: 100,
  LEVER: 100,
  ASHBY: 100,
};

export function applySourceCap(
  leads: RawLead[],
  caps: Partial<Record<string, number>> = SOURCE_SCAN_CAPS
): { kept: RawLead[]; capped: number } {
  const bySource: Record<string, RawLead[]> = {};
  for (const lead of leads) {
    if (!bySource[lead.source]) bySource[lead.source] = [];
    bySource[lead.source].push(lead);
  }

  const kept: RawLead[] = [];
  let capped = 0;
  for (const [source, items] of Object.entries(bySource)) {
    const limit = caps[source] ?? 100;
    if (items.length > limit) capped += items.length - limit;
    kept.push(...items.slice(0, limit));
  }
  return { kept, capped };
}
