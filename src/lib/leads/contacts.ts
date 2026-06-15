import { prisma } from "@/lib/db";
import { extractPeople, fetchPage, stripHtml } from "./scrape";

const RECRUITER_PATTERNS = [
  /(?:recruiter|talent|hiring manager|hr|people ops)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /contact[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /(?:reach out to|email)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
];

export interface FindContactsResult {
  added: number;
  total: number;
}

export async function findContacts(companyId: string): Promise<FindContactsResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { jobLeads: { take: 10, orderBy: { capturedAt: "desc" } } },
  });
  if (!company) throw new Error("Company not found");

  let added = 0;

  for (const job of company.jobLeads) {
    const text = job.description ?? "";
    for (const pattern of RECRUITER_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const existing = await prisma.contact.findFirst({ where: { companyId, name } });
        if (existing) continue;
        await prisma.contact.create({
          data: {
            companyId,
            name,
            title: "Mentioned in job posting",
            source: `job_posting:${job.id}`,
            confidence: "MEDIUM",
          },
        });
        added++;
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
        const existing = await prisma.contact.findFirst({
          where: { companyId, name: person.name },
        });
        if (existing) continue;
        await prisma.contact.create({
          data: {
            companyId,
            name: person.name,
            title: person.title,
            source: `scrape:${url}`,
            confidence: "MEDIUM",
          },
        });
        added++;
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
        const existing = await prisma.contact.findFirst({ where: { companyId, name: m.login } });
        if (existing) continue;
        await prisma.contact.create({
          data: {
            companyId,
            name: m.login,
            title: "GitHub org member",
            source: "github_org",
            confidence: "LOW",
          },
        });
        added++;
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
