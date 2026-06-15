import type { DiscoveryItem } from "./types";

const USER_AGENT = "CurioStudio/1.0";

interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description: string | null;
  star_count: number;
  forks_count?: number;
  last_activity_at?: string;
  topics?: string[];
  default_branch?: string;
  web_url: string;
}

export async function fetchGitLabTrending(): Promise<DiscoveryItem[]> {
  const url =
    "https://gitlab.com/api/v4/projects?order_by=star_count&sort=desc&visibility=public&per_page=25";

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GitLab API error (${res.status})`);
  }

  const projects = (await res.json()) as GitLabProject[];

  return projects.map((project, index) => {
    const parts = project.path_with_namespace.split("/");
    const repo = parts.pop() ?? project.name;
    const owner = parts.join("/") || "unknown";

    return {
      source: "GITLAB" as const,
      owner,
      repo,
      fullName: project.path_with_namespace,
      url: project.web_url,
      description: project.description?.trim() || "GitLab project",
      language: project.topics?.[0] ?? null,
      taskType: null,
      starsToday: null,
      metricLabel: "stars",
      metricValue: (project.star_count ?? 0).toLocaleString(),
      rank: index + 1,
    };
  });
}
