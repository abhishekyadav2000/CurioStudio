import { prisma } from "@/lib/db";
import { extractEmails, extractPeople, fetchPage, stripHtml } from "./scrape";

const RECRUITER_PATTERNS = [
  /(?:recruiter|talent acquisition|hiring manager|hr|people ops|talent partner)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /contact[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /(?:reach out to|email|questions\?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /(?:reporting to|manager)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
];

const RECRUITER_TITLE_PATTERN = /(?:recruiter|talent|hiring|hr|people)/i;

export interface FindContactsResult {
  added: number;
  total: number;
}

async function upsertJobContact(
  companyId: string,
  data: {
    name: string;
    title?: string;
    email?: string;
    source: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
  }
): Promise<boolean> {
  const existing = await prisma.contact.findFirst({
    where: {
      companyId,
      OR: [
        data.email ? { email: data.email } : { name: data.name, title: data.title ?? null },
      ],
    },
  });
  if (existing) return false;
  await prisma.contact.create({ data: { companyId, ...data } });
  return true;
}

/** Parse contacts from job posting descriptions (emails, recruiter names). */
export async function extractContactsFromJobPostings(companyId: string): Promise<number> {
  const jobs = await prisma.jobLead.findMany({
    where: { companyId, status: { not: "ARCHIVED" } },
    orderBy: { capturedAt: "desc" },
    take: 20,
  });

  let added = 0;

  for (const job of jobs) {
    const text = job.description ?? "";
    if (!text) continue;

    for (const email of extractEmails(text)) {
      const isRecruiter = /recruit|talent|hr|hiring|careers|jobs/i.test(email);
      if (
        await upsertJobContact(companyId, {
          name: email.split("@")[0].replace(/[._]/g, " "),
          email,
          title: isRecruiter ? "Recruiter (from posting)" : "Contact (from posting)",
          source: `job_posting:${job.id}`,
          confidence: isRecruiter ? "HIGH" : "MEDIUM",
        })
      ) {
        added++;
      }
    }

    for (const pattern of RECRUITER_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name.length < 4) continue;
        if (
          await upsertJobContact(companyId, {
            name,
            title: "Mentioned in job posting",
            source: `job_posting:${job.id}`,
            confidence: "MEDIUM",
          })
        ) {
          added++;
        }
      }
    }
  }

  return added;
}

export async function findContacts(companyId: string): Promise<FindContactsResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { jobLeads: { take: 10, orderBy: { capturedAt: "desc" } } },
  });
  if (!company) throw new Error("Company not found");

  let added = 0;
  added += await extractContactsFromJobPostings(companyId);

  for (const job of company.jobLeads) {
    const text = job.description ?? "";
    for (const pattern of RECRUITER_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (await upsertJobContact(companyId, { name, title: "Mentioned in job posting", source: `job_posting:${job.id}`, confidence: "MEDIUM" })) {
          added++;
        }
      }
    }
  }

  if (company.website) {
    const aboutUrl = company.website.replace(/\/$/, "") + "/about";
    const teamUrl = company.website.replace(/\/$/, "") + "/team";
    for (const url of [aboutUrl, teamUrl]) {
      const html = await fetchPage(url);
      if (!html) continue;
      for (const person of extractPeople(html)) {
        const title = person.title ?? "";
        const confidence = RECRUITER_TITLE_PATTERN.test(title) ? "HIGH" as const : "MEDIUM" as const;
        if (await upsertJobContact(companyId, { ...person, source: `scrape:${url}`, confidence })) {
          added++;
        }
      }
    }
  }

  if (company.githubOrg) {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    };
    const res = await fetch(
      `https://api.github.com/orgs/${encodeURIComponent(company.githubOrg)}/members?per_page=15`,
      { cache: "no-store", headers }
    );
    if (res.ok) {
      const members = (await res.json()) as { login: string }[];
      for (const m of members) {
        if (await upsertJobContact(companyId, { name: m.login, title: "GitHub org member", source: "github_org", confidence: "LOW" })) {
          added++;
        }
      }
    }
  }

  const total = await prisma.contact.count({ where: { companyId } });
  return { added, total };
}

export function parseJobRequirements(description?: string | null): string[] {
  if (!description) return [];
  const text = stripHtml(description);
  const reqs: string[] = [];
  const lines = text.split(/[\n•·\-*]/).map((l) => l.trim()).filter((l) => l.length > 10 && l.length < 200);
  for (const line of lines) {
    if (/required|must have|experience with|proficiency|skills/i.test(line)) {
      reqs.push(line);
    }
  }
  return reqs.slice(0, 15);
}
