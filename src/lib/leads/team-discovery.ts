import { prisma } from "@/lib/db";
import { extractEmails, extractPeople, fetchPage } from "./scrape";
import { extractContactsFromJobPostings } from "./contacts";

const GITHUB_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

const MANAGER_TITLES = /engineering manager|director of engineering|vp of engineering|head of engineering|cto|chief technology/i;
const RECRUITER_TITLES = /recruit|talent|hiring|hr|people ops|talent acquisition/i;
const RELEVANT_TITLES = /engineer|manager|director|recruit|talent|hiring|hr|people|lead|head|vp|cto/i;

const HIRING_MANAGER_PATTERNS = [
  /hiring manager[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /reporting to[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
  /(?:managed by|manager)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi,
];

function titleRelevance(title: string | null | undefined, jobTitle?: string): number {
  if (!title) return 0;
  let score = 0;
  if (RECRUITER_TITLES.test(title)) score += 40;
  if (MANAGER_TITLES.test(title)) score += 35;
  if (RELEVANT_TITLES.test(title)) score += 15;
  if (jobTitle) {
    const jobWords = jobTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const titleLower = title.toLowerCase();
    for (const w of jobWords) {
      if (titleLower.includes(w)) score += 10;
    }
  }
  return score;
}

function confidenceFromTitle(title?: string | null): "HIGH" | "MEDIUM" | "LOW" {
  if (!title) return "LOW";
  if (RECRUITER_TITLES.test(title)) return "HIGH";
  if (MANAGER_TITLES.test(title)) return "MEDIUM";
  return "LOW";
}

async function upsertDiscoveredContact(
  companyId: string,
  data: {
    name: string;
    title?: string;
    email?: string;
    linkedinUrl?: string;
    source: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    reportsToId?: string;
  }
): Promise<string | null> {
  const existing = await prisma.contact.findFirst({
    where: {
      companyId,
      OR: [
        data.email ? { email: data.email } : {},
        { name: data.name, title: data.title ?? null },
      ].filter((o) => Object.keys(o).length > 0),
    },
  });
  if (existing) {
    if (data.reportsToId && !existing.reportsToId) {
      await prisma.contact.update({ where: { id: existing.id }, data: { reportsToId: data.reportsToId } });
    }
    return existing.id;
  }
  const created = await prisma.contact.create({
    data: { companyId, ...data },
  });
  return created.id;
}

async function discoverFromGitHub(companyId: string, githubOrg: string, jobTitle?: string): Promise<number> {
  let added = 0;
  const res = await fetch(
    `https://api.github.com/orgs/${encodeURIComponent(githubOrg)}/members?per_page=20`,
    { cache: "no-store", headers: GITHUB_HEADERS }
  );
  if (!res.ok) return 0;

  const members = (await res.json()) as { login: string }[];
  for (const m of members) {
    let title = "GitHub org member";
    let bio = "";
    try {
      const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(m.login)}`, {
        cache: "no-store",
        headers: GITHUB_HEADERS,
      });
      if (userRes.ok) {
        const user = (await userRes.json()) as { bio?: string; name?: string };
        bio = user.bio ?? "";
        const titleMatch = bio.match(/(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Engineer|Manager|Director|Lead|Recruiter|Developer))?)/);
        if (titleMatch) title = titleMatch[1];
      }
    } catch {
      // use default title
    }

    const relevance = titleRelevance(title, jobTitle);
    if (relevance < 10 && !bio) continue;

    const id = await upsertDiscoveredContact(companyId, {
      name: m.login,
      title,
      source: "github_org",
      confidence: confidenceFromTitle(title),
    });
    if (id) added++;
  }
  return added;
}

async function discoverFromTeamPages(companyId: string, website: string, jobTitle?: string): Promise<number> {
  let added = 0;
  const base = website.replace(/\/$/, "");
  const urls = [`${base}/team`, `${base}/about`, `${base}/about-us`, `${base}/company`];

  for (const url of urls) {
    const html = await fetchPage(url);
    if (!html) continue;
    for (const person of extractPeople(html)) {
      const relevance = titleRelevance(person.title, jobTitle);
      if (relevance < 5) continue;
      const id = await upsertDiscoveredContact(companyId, {
        name: person.name,
        title: person.title,
        source: `team_page:${url}`,
        confidence: confidenceFromTitle(person.title),
      });
      if (id) added++;
    }
  }
  return added;
}

async function inferReportingLines(companyId: string): Promise<number> {
  const contacts = await prisma.contact.findMany({ where: { companyId } });
  const managers = contacts.filter((c) => c.title && MANAGER_TITLES.test(c.title));
  const recruiters = contacts.filter((c) => c.title && RECRUITER_TITLES.test(c.title));
  let linked = 0;

  for (const contact of contacts) {
    if (contact.reportsToId) continue;
    const isEngineer = /engineer|developer|designer/i.test(contact.title ?? "");
    if (!isEngineer) continue;

    const manager = managers.find((m) => m.id !== contact.id);
    if (manager) {
      await prisma.contact.update({ where: { id: contact.id }, data: { reportsToId: manager.id } });
      linked++;
    } else if (recruiters[0]) {
      await prisma.contact.update({ where: { id: contact.id }, data: { reportsToId: recruiters[0].id } });
      linked++;
    }
  }
  return linked;
}

export interface TeamDiscoveryResult {
  companyId: string;
  contactsAdded: number;
  reportingLinks: number;
  total: number;
}

/** Discover relevant people for a company + optional job title. */
export async function discoverTeam(
  companyId: string,
  jobTitle?: string
): Promise<TeamDiscoveryResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  let contactsAdded = 0;

  contactsAdded += await extractContactsFromJobPostings(companyId);

  if (company.githubOrg) {
    contactsAdded += await discoverFromGitHub(companyId, company.githubOrg, jobTitle);
  }

  if (company.website) {
    contactsAdded += await discoverFromTeamPages(companyId, company.website, jobTitle);
  }

  if (jobTitle) {
    const jobs = await prisma.jobLead.findMany({
      where: { companyId, title: { contains: jobTitle.split(" ")[0] } },
      take: 5,
    });
    for (const job of jobs) {
      const text = job.description ?? "";
      for (const pattern of HIRING_MANAGER_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          const name = match[1].trim();
          if (name.length < 4) continue;
          const id = await upsertDiscoveredContact(companyId, {
            name,
            title: "Hiring manager (from posting)",
            source: `job_posting:${job.id}`,
            confidence: "HIGH",
          });
          if (id) contactsAdded++;
        }
      }
      for (const email of extractEmails(text)) {
        const id = await upsertDiscoveredContact(companyId, {
          name: email.split("@")[0].replace(/[._]/g, " "),
          email,
          title: /recruit|talent|hr/i.test(email) ? "Recruiter (from posting)" : "Contact (from posting)",
          source: `job_posting:${job.id}`,
          confidence: /recruit|talent|hr/i.test(email) ? "HIGH" : "MEDIUM",
        });
        if (id) contactsAdded++;
      }
    }
  }

  const reportingLinks = await inferReportingLines(companyId);
  const total = await prisma.contact.count({ where: { companyId } });

  return { companyId, contactsAdded, reportingLinks, total };
}

/** Lightweight team discovery for up to N companies during scan/enrich. */
export async function discoverTeamsForRecentCompanies(limit = 3): Promise<TeamDiscoveryResult[]> {
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { githubOrg: { not: null } },
        { website: { not: null } },
      ],
    },
    orderBy: { lastEnrichedAt: "asc" },
    take: limit,
  });

  const results: TeamDiscoveryResult[] = [];
  for (const co of companies) {
    try {
      const job = await prisma.jobLead.findFirst({
        where: { companyId: co.id, status: { not: "ARCHIVED" } },
        orderBy: { relevanceScore: "desc" },
      });
      results.push(await discoverTeam(co.id, job?.title));
    } catch (err) {
      console.error(`[team-discovery] ${co.name}:`, err);
    }
  }
  return results;
}
