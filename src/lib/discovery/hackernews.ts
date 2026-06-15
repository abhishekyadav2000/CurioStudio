import type { DiscoveryItem } from "./types";

interface HNItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  by?: string;
  descendants?: number;
}

/** Hacker News Show HN stories — prefers GitHub links when present. */
export async function fetchHackerNewsShow(): Promise<DiscoveryItem[]> {
  const listRes = await fetch("https://hacker-news.firebaseio.com/v0/showstories.json", {
    cache: "no-store",
  });
  if (!listRes.ok) throw new Error(`HN fetch failed: ${listRes.status}`);

  const ids = ((await listRes.json()) as number[]).slice(0, 30);
  const items: DiscoveryItem[] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
      cache: "no-store",
    });
    if (!itemRes.ok) continue;
    const story = (await itemRes.json()) as HNItem;
    if (!story.title) continue;

    const url = story.url ?? `https://news.ycombinator.com/item?id=${id}`;
    const githubMatch = url.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
    const owner = githubMatch?.[1] ?? story.by ?? "hn";
    const repo = githubMatch?.[2]?.replace(/\.git$/, "") ?? `show-${id}`;

    items.push({
      source: "HACKER_NEWS",
      owner,
      repo,
      fullName: githubMatch ? `${owner}/${repo}` : story.title.slice(0, 60),
      url: githubMatch ? `https://github.com/${owner}/${repo}` : url,
      description: story.title,
      language: githubMatch ? null : null,
      taskType: "Show HN",
      starsToday: story.score != null ? `${story.score} pts` : null,
      metricLabel: "comments",
      metricValue: story.descendants != null ? String(story.descendants) : null,
      rank: items.length + 1,
    });
    if (items.length >= 25) break;
  }

  return items;
}
