import type { RawLead } from "./types";

interface GitHubIssue {
  title: string;
  html_url: string;
  body?: string | null;
  created_at: string;
  user?: { login: string };
}

interface GitHubSearchResponse {
  items: GitHubIssue[];
}

interface GitHubRepo {
  name: string;
  html_url: string;
  description?: string | null;
  updated_at: string;
  owner: { login: string };
}

interface GitHubOrgReposResponse extends Array<GitHubRepo> {}

const HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

/** Search GitHub issues/discussions for hiring posts. */
export async function fetchGitHubSearchLeads(): Promise<RawLead[]> {
  const queries = [
    `"we're hiring" in:title,body`,
    `"we are hiring" in:title,body`,
    `"join our team" in:title,body`,
  ];

  const seen = new Set<string>();
  const leads: RawLead[] = [];

  for (const q of queries) {
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=20`;
    const res = await fetch(url, { cache: "no-store", headers: HEADERS });
    if (!res.ok) continue;

    const data = (await res.json()) as GitHubSearchResponse;

    for (const item of data.items ?? []) {
      if (seen.has(item.html_url)) continue;
      seen.add(item.html_url);

      leads.push({
        title: item.title,
        url: item.html_url,
        source: "GITHUB",
        companyName: item.user?.login,
        postedAt: new Date(item.created_at),
        description: item.body?.slice(0, 2000) ?? undefined,
      });
    }
  }

  return leads.slice(0, 30);
}

/** Track known company GitHub orgs for hiring-related activity. */
export async function fetchGitHubOrgLeads(
  orgs: { name: string; githubOrg: string }[]
): Promise<RawLead[]> {
  const leads: RawLead[] = [];

  for (const { name, githubOrg } of orgs) {
    const url = `https://api.github.com/search/issues?q=org:${encodeURIComponent(githubOrg)}+hiring&sort=created&order=desc&per_page=10`;
    const res = await fetch(url, { cache: "no-store", headers: HEADERS });
    if (!res.ok) continue;

    const data = (await res.json()) as GitHubSearchResponse;

    for (const item of data.items ?? []) {
      leads.push({
        title: item.title,
        url: item.html_url,
        source: "GITHUB",
        companyName: name,
        postedAt: new Date(item.created_at),
        description: item.body?.slice(0, 2000) ?? undefined,
      });
    }

    const reposUrl = `https://api.github.com/orgs/${encodeURIComponent(githubOrg)}/repos?sort=updated&per_page=5`;
    const reposRes = await fetch(reposUrl, { cache: "no-store", headers: HEADERS });
    if (reposRes.ok) {
      const repos = (await reposRes.json()) as GitHubOrgReposResponse;
      for (const repo of repos) {
        const desc = repo.description ?? "";
        if (!/hiring|join us|careers|we're looking/i.test(desc)) continue;
        const repoUrl = `${repo.html_url}#readme`;
        leads.push({
          title: `${name}: ${repo.name} — hiring signal`,
          url: repoUrl,
          source: "GITHUB",
          companyName: name,
          postedAt: new Date(repo.updated_at),
          description: desc.slice(0, 2000),
        });
      }
    }
  }

  return leads;
}
