import { prisma } from "@/lib/db";
import {
  extractEmails,
  extractMeta,
  extractPeople,
  extractTitle,
  fetchCompanyPages,
  guessDomain,
  stripHtml,
} from "./scrape";

const GITHUB_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

interface GitHubOrg {
  name?: string;
  description?: string;
  blog?: string;
  location?: string;
  public_repos?: number;
  html_url?: string;
}

interface GitHubRepo {
  name: string;
  language?: string | null;
  html_url: string;
  description?: string | null;
  pushed_at?: string;
}

export interface EnrichResult {
  companyId: string;
  contactsAdded: number;
  intelAdded: number;
  fieldsUpdated: string[];
}

async function upsertContact(
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

  await prisma.contact.create({
    data: {
      companyId,
      name: data.name,
      title: data.title,
      email: data.email,
      source: data.source,
      confidence: data.confidence,
    },
  });
  return true;
}

async function addIntel(
  companyId: string,
  data: {
    type: "JOB_POST" | "NEWS" | "PRODUCT" | "FUNDING" | "PERSON_MENTION";
    title: string;
    url?: string;
    summary?: string;
    publishedAt?: Date;
    rawData?: unknown;
  }
): Promise<boolean> {
  const dup = await prisma.companyIntel.findFirst({
    where: { companyId, title: data.title, url: data.url ?? null },
  });
  if (dup) return false;

  await prisma.companyIntel.create({
    data: {
      companyId,
      type: data.type,
      title: data.title,
      url: data.url,
      summary: data.summary,
      publishedAt: data.publishedAt,
      rawData: data.rawData ? JSON.stringify(data.rawData) : null,
    },
  });
  return true;
}

export async function enrichCompany(companyId: string): Promise<EnrichResult> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error("Company not found");

  let contactsAdded = 0;
  let intelAdded = 0;
  const fieldsUpdated: string[] = [];

  const domain = company.domain ?? guessDomain(company.website, company.name);
  const website =
    company.website ??
    (domain ? `https://${domain}` : undefined);

  const updateData: Record<string, unknown> = { lastEnrichedAt: new Date() };
  if (domain && !company.domain) {
    updateData.domain = domain;
    fieldsUpdated.push("domain");
  }

  if (website) {
    const pages = await fetchCompanyPages(website);
    const allHtml = pages.map((p) => p.html).join("\n");
    const homepage = pages[0]?.html ?? "";

    const description =
      extractMeta(homepage, "description") ??
      extractMeta(homepage, "og:description") ??
      stripHtml(homepage).slice(0, 500);

    if (description && !company.description) {
      updateData.description = description.slice(0, 2000);
      fieldsUpdated.push("description");
    }

    if (!company.website) {
      updateData.website = website;
      fieldsUpdated.push("website");
    }

    for (const email of extractEmails(allHtml)) {
      if (await upsertContact(companyId, { name: email.split("@")[0], email, source: "website_scrape", confidence: "LOW" })) {
        contactsAdded++;
      }
    }

    for (const person of extractPeople(allHtml)) {
      if (await upsertContact(companyId, { ...person, source: "team_page", confidence: "MEDIUM" })) {
        contactsAdded++;
      }
    }

    for (const page of pages) {
      const pageTitle = extractTitle(page.html) ?? page.url;
      if (/career|job|hiring/i.test(page.url)) {
        if (await addIntel(companyId, { type: "JOB_POST", title: pageTitle, url: page.url, summary: stripHtml(page.html).slice(0, 500) })) {
          intelAdded++;
        }
      }
    }
  }

  const githubOrg = company.githubOrg ?? company.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (githubOrg) {
    const orgRes = await fetch(`https://api.github.com/orgs/${encodeURIComponent(githubOrg)}`, {
      cache: "no-store",
      headers: GITHUB_HEADERS,
    });

    if (orgRes.ok) {
      const org = (await orgRes.json()) as GitHubOrg;
      if (org.description && !company.description) {
        updateData.description = org.description;
        fieldsUpdated.push("description");
      }
      if (org.location && !company.headquarters) {
        updateData.headquarters = org.location;
        fieldsUpdated.push("headquarters");
      }
      if (org.blog && !company.website) {
        updateData.website = org.blog;
        fieldsUpdated.push("website");
      }
      if (!company.githubOrg) {
        updateData.githubOrg = githubOrg;
        fieldsUpdated.push("githubOrg");
      }

      if (await addIntel(companyId, {
        type: "PRODUCT",
        title: `${org.name ?? githubOrg} GitHub organization`,
        url: org.html_url,
        summary: org.description ?? `${org.public_repos ?? 0} public repos`,
      })) {
        intelAdded++;
      }

      const reposRes = await fetch(
        `https://api.github.com/orgs/${encodeURIComponent(githubOrg)}/repos?sort=pushed&per_page=10`,
        { cache: "no-store", headers: GITHUB_HEADERS }
      );

      if (reposRes.ok) {
        const repos = (await reposRes.json()) as GitHubRepo[];
        const languages = [...new Set(repos.map((r) => r.language).filter(Boolean))] as string[];
        if (languages.length) {
          updateData.techStack = JSON.stringify(languages);
          fieldsUpdated.push("techStack");
        }

        for (const repo of repos.slice(0, 5)) {
          if (await addIntel(companyId, {
            type: "PRODUCT",
            title: repo.name,
            url: repo.html_url,
            summary: repo.description ?? undefined,
            publishedAt: repo.pushed_at ? new Date(repo.pushed_at) : undefined,
          })) {
            intelAdded++;
          }
        }
      }

      const membersRes = await fetch(
        `https://api.github.com/orgs/${encodeURIComponent(githubOrg)}/members?per_page=10`,
        { cache: "no-store", headers: GITHUB_HEADERS }
      );

      if (membersRes.ok) {
        const members = (await membersRes.json()) as { login: string; html_url: string }[];
        for (const member of members) {
          if (await upsertContact(companyId, {
            name: member.login,
            title: "GitHub contributor",
            source: "github_org",
            confidence: "MEDIUM",
          })) {
            contactsAdded++;
          }
          if (await addIntel(companyId, {
            type: "PERSON_MENTION",
            title: member.login,
            url: member.html_url,
            summary: "Public GitHub org member",
          })) {
            intelAdded++;
          }
        }
      }
    }
  }

  await prisma.company.update({ where: { id: companyId }, data: updateData });

  return { companyId, contactsAdded, intelAdded, fieldsUpdated };
}

export async function enrichAllCompanies(): Promise<{ enriched: number; results: EnrichResult[] }> {
  const companies = await prisma.company.findMany({ orderBy: { lastEnrichedAt: "asc" } });
  const results: EnrichResult[] = [];

  for (const co of companies) {
    try {
      results.push(await enrichCompany(co.id));
    } catch (err) {
      console.error(`[enrich] failed for ${co.name}:`, err);
    }
  }

  return { enriched: results.length, results };
}
