import type { DiscoverySource } from "@prisma/client";
import type { DiscoveryItem, TrendingFetchOptions } from "./types";
import { fetchGitHubTrending } from "./github";
import { fetchHuggingFaceTrending } from "./huggingface";
import { fetchDockerHubPopular } from "./dockerhub";
import { fetchKaggleTrending } from "./kaggle";
import { fetchGitLabTrending } from "./gitlab";
import { fetchNpmTrending } from "./npm";
import { fetchPyPITrending } from "./pypi";
import { fetchHackerNewsShow } from "./hackernews";
import { fetchAwesomeLists } from "./awesome";

export type { DiscoveryItem, TrendingFetchOptions, TrendingSource } from "./types";
export { SOURCE_LABELS, parseTrendingSource } from "./types";
export { fetchGitHubTrending } from "./github";

export async function fetchTrending(
  source: DiscoverySource,
  options: TrendingFetchOptions = {}
): Promise<DiscoveryItem[]> {
  switch (source) {
    case "GITHUB":
      return fetchGitHubTrending(options);
    case "HUGGINGFACE":
      return fetchHuggingFaceTrending(options.kind ?? "spaces");
    case "DOCKER_HUB":
      return fetchDockerHubPopular();
    case "KAGGLE":
      return fetchKaggleTrending(options.kind === "models" ? "notebooks" : "datasets");
    case "GITLAB":
      return fetchGitLabTrending();
    case "NPM":
      return fetchNpmTrending();
    case "PYPI":
      return fetchPyPITrending();
    case "HACKER_NEWS":
      return fetchHackerNewsShow();
    case "AWESOME":
      return fetchAwesomeLists();
    default:
      throw new Error(`Unsupported discovery source: ${source}`);
  }
}

export async function syncTrendingToDb(
  source: DiscoverySource,
  options: TrendingFetchOptions = {}
): Promise<DiscoveryItem[]> {
  const { prisma } = await import("@/lib/db");
  const items = await fetchTrending(source, options);
  const period = options.period || "daily";
  const spokenLanguage = options.spokenLanguage ?? "en";
  const progLanguage = options.language ?? "";

  await prisma.trendingEntry.deleteMany({
    where: { source, period, spokenLanguage, progLanguage },
  });

  for (const item of items) {
    await prisma.trendingEntry.upsert({
      where: {
        source_fullName: { source: item.source, fullName: item.fullName },
      },
      create: {
        source: item.source,
        owner: item.owner,
        repo: item.repo,
        fullName: item.fullName,
        url: item.url,
        description: item.description,
        language: item.language,
        taskType: item.taskType,
        starsToday: item.starsToday,
        metricLabel: item.metricLabel,
        metricValue: item.metricValue,
        period,
        spokenLanguage,
        progLanguage,
        rank: item.rank,
      },
      update: {
        description: item.description,
        language: item.language,
        taskType: item.taskType,
        starsToday: item.starsToday,
        metricLabel: item.metricLabel,
        metricValue: item.metricValue,
        rank: item.rank,
        fetchedAt: new Date(),
        period,
        spokenLanguage,
        progLanguage,
      },
    });
  }

  return items;
}

export function sourceExternalUrl(
  source: DiscoverySource,
  options: TrendingFetchOptions = {}
): string {
  switch (source) {
    case "GITHUB": {
      const params = new URLSearchParams();
      if (options.period === "weekly") params.set("since", "weekly");
      if (options.spokenLanguage) params.set("spoken_language_code", options.spokenLanguage);
      const qs = params.toString();
      if (options.language) {
        return `https://github.com/trending/${options.language}${qs ? `?${qs}` : ""}`;
      }
      return `https://github.com/trending${qs ? `?${qs}` : ""}`;
    }
    case "HUGGINGFACE":
      return options.kind === "models"
        ? "https://huggingface.co/models?sort=likes"
        : "https://huggingface.co/spaces?sort=likes";
    case "DOCKER_HUB":
      return "https://hub.docker.com/search?q=&type=image";
    case "KAGGLE":
      return options.kind === "models"
        ? "https://www.kaggle.com/code?sort=hottest"
        : "https://www.kaggle.com/datasets?sort=hottest";
    case "GITLAB":
      return "https://gitlab.com/explore/projects/starred";
    case "NPM":
      return "https://www.npmjs.com/search?q=keywords:react";
    case "PYPI":
      return "https://pypi.org/";
    case "HACKER_NEWS":
      return "https://news.ycombinator.com/show";
    case "AWESOME":
      return "https://github.com/sindresorhus/awesome";
    default:
      return "https://github.com/trending";
  }
}
