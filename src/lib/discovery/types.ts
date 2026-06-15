import type { DiscoverySource } from "@prisma/client";

export type TrendingSource =
  | Lowercase<DiscoverySource>
  | "github"
  | "huggingface"
  | "dockerhub"
  | "kaggle"
  | "gitlab"
  | "npm"
  | "pypi"
  | "hackernews"
  | "awesome";

export interface DiscoveryItem {
  source: DiscoverySource;
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  description: string;
  language: string | null;
  taskType: string | null;
  starsToday: string | null;
  metricLabel: string | null;
  metricValue: string | null;
  rank: number;
}

export interface TrendingFetchOptions {
  period?: "daily" | "weekly";
  language?: string;
  spokenLanguage?: string;
  kind?: "spaces" | "models";
}

export const SOURCE_LABELS: Record<DiscoverySource, string> = {
  GITHUB: "GitHub",
  HUGGINGFACE: "Hugging Face",
  DOCKER_HUB: "Docker Hub",
  KAGGLE: "Kaggle",
  GITLAB: "GitLab",
  NPM: "npm",
  PYPI: "PyPI",
  HACKER_NEWS: "Hacker News",
  AWESOME: "Awesome Lists",
};

export function parseTrendingSource(raw: string | null): DiscoverySource {
  const value = (raw ?? "github").toLowerCase().replace(/-/g, "_");
  const map: Record<string, DiscoverySource> = {
    github: "GITHUB",
    huggingface: "HUGGINGFACE",
    hf: "HUGGINGFACE",
    dockerhub: "DOCKER_HUB",
    docker_hub: "DOCKER_HUB",
    docker: "DOCKER_HUB",
    kaggle: "KAGGLE",
    gitlab: "GITLAB",
    npm: "NPM",
    pypi: "PYPI",
    hackernews: "HACKER_NEWS",
    hacker_news: "HACKER_NEWS",
    hn: "HACKER_NEWS",
    awesome: "AWESOME",
  };
  return map[value] ?? "GITHUB";
}
