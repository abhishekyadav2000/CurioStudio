import { prisma } from "@/lib/db";
import { isAllowedUrl } from "./quality";

const VERIFY_TIMEOUT_MS = 10_000;

export interface VerifyResult {
  leadId: string;
  isAlive: boolean;
  actualPostedAt: Date | null;
  verifiedAt: Date;
  archived: boolean;
}

function parseJsonLdDatePosted(html: string): Date | null {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!blocks) return null;
  for (const block of blocks) {
    const inner = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
    try {
      const data = JSON.parse(inner) as Record<string, unknown>;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const type = String(item["@type"] ?? "");
        if (type.includes("JobPosting")) {
          const posted = item.datePosted ?? item.dateCreated;
          if (posted) return new Date(String(posted));
        }
      }
    } catch {
      // continue
    }
  }
  return null;
}

function parseMetaDate(html: string): Date | null {
  const patterns = [
    /property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /name=["']date["'][^>]*content=["']([^"']+)["']/i,
    /datetime=["']([^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

async function fetchGreenhouseDate(url: string): Promise<Date | null> {
  const m = url.match(/greenhouse\.io\/[^/]+\/jobs\/(\d+)/i);
  if (!m) return null;
  const boardMatch = url.match(/boards\.greenhouse\.io\/([^/]+)/i);
  if (!boardMatch) return null;
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardMatch[1])}/jobs/${m[1]}`,
      { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const job = (await res.json()) as { updated_at?: string; first_published?: string };
    const raw = job.updated_at ?? job.first_published;
    return raw ? new Date(raw) : null;
  } catch {
    return null;
  }
}

async function fetchLeverDate(url: string): Promise<Date | null> {
  const m = url.match(/jobs\.lever\.co\/([^/]+)\/([a-f0-9-]+)/i);
  if (!m) return null;
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${encodeURIComponent(m[1])}/${m[2]}`,
      { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS) }
    );
    if (!res.ok) return null;
    const job = (await res.json()) as { createdAt?: number; updatedAt?: number };
    const ts = job.updatedAt ?? job.createdAt;
    return ts ? new Date(ts) : null;
  } catch {
    return null;
  }
}

async function checkUrlAlive(url: string): Promise<{ alive: boolean; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "CurioStudio-InsiderTracker/1.0" },
    });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "CurioStudio-InsiderTracker/1.0" },
      });
    }
    const alive = res.status < 400 && res.status !== 404;
    return { alive, finalUrl: res.url };
  } catch {
    return { alive: false, finalUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

async function parsePostedDateFromPage(url: string, html: string): Promise<Date | null> {
  if (/greenhouse\.io/i.test(url)) {
    const gh = await fetchGreenhouseDate(url);
    if (gh) return gh;
  }
  if (/lever\.co/i.test(url)) {
    const lv = await fetchLeverDate(url);
    if (lv) return lv;
  }
  return parseJsonLdDatePosted(html) ?? parseMetaDate(html);
}

/** Verify a single job lead URL is alive and extract actual posted date when possible. */
export async function verifyJobLead(leadId: string): Promise<VerifyResult> {
  const lead = await prisma.jobLead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const verifiedAt = new Date();
  let isAlive = true;
  let actualPostedAt: Date | null = lead.actualPostedAt ?? lead.postedAt ?? null;

  if (!isAllowedUrl(lead.url)) {
    isAlive = false;
  } else {
    const { alive } = await checkUrlAlive(lead.url);
    isAlive = alive;

    if (alive) {
      try {
        const res = await fetch(lead.url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
          headers: { "User-Agent": "CurioStudio-InsiderTracker/1.0" },
        });
        if (res.ok) {
          const html = await res.text();
          const parsed = await parsePostedDateFromPage(lead.url, html);
          if (parsed) actualPostedAt = parsed;
        }
      } catch {
        // keep existing date
      }
    }
  }

  let archived = false;
  const updateData: {
    verifiedAt: Date;
    isAlive: boolean;
    actualPostedAt: Date | null;
    postedAt?: Date;
    status?: "ARCHIVED";
  } = { verifiedAt, isAlive, actualPostedAt };

  if (!isAlive && lead.status !== "ARCHIVED") {
    updateData.status = "ARCHIVED";
    archived = true;
  } else if (actualPostedAt && !lead.postedAt) {
    updateData.postedAt = actualPostedAt;
  }

  await prisma.jobLead.update({ where: { id: leadId }, data: updateData });

  return { leadId, isAlive, actualPostedAt, verifiedAt, archived };
}

/** Verify multiple leads; archive dead links. */
export async function verifyJobLeads(leadIds?: string[], limit = 50): Promise<{
  verified: number;
  dead: number;
  archived: number;
}> {
  const leads = leadIds?.length
    ? await prisma.jobLead.findMany({ where: { id: { in: leadIds }, status: { not: "ARCHIVED" } } })
    : await prisma.jobLead.findMany({
        where: { status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] } },
        orderBy: { capturedAt: "desc" },
        take: limit,
      });

  let verified = 0;
  let dead = 0;
  let archived = 0;

  for (const lead of leads) {
    try {
      const result = await verifyJobLead(lead.id);
      verified++;
      if (!result.isAlive) dead++;
      if (result.archived) archived++;
    } catch (err) {
      console.error(`[verify] lead ${lead.id}:`, err);
    }
  }

  return { verified, dead, archived };
}
