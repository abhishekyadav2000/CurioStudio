import type { DiscoveryItem } from "./types";

export interface TrendingOptions {
  period?: "daily" | "weekly";
  language?: string;
  spokenLanguage?: string;
}

export async function fetchGitHubTrending(options: TrendingOptions = {}): Promise<DiscoveryItem[]> {
  const { period = "daily", language = "", spokenLanguage = "en" } = options;

  const params = new URLSearchParams();
  if (period === "weekly") params.set("since", "weekly");
  if (spokenLanguage) params.set("spoken_language_code", spokenLanguage);

  let url: string;
  if (language) {
    const qs = params.toString();
    url = `https://github.com/trending/${language}${qs ? `?${qs}` : ""}`;
  } else {
    url = `https://github.com/trending${params.toString() ? `?${params.toString()}` : ""}`;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CurioStudio/1.0)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GitHub trending fetch failed: ${res.status}`);
  }

  const html = await res.text();
  return parseTrendingHTML(html);
}

function parseTrendingHTML(html: string): DiscoveryItem[] {
  const repos: DiscoveryItem[] = [];

  const articleRegex = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;
  let rank = 0;

  while ((match = articleRegex.exec(html)) !== null) {
    rank++;
    const block = match[1];

    const linkMatch = block.match(
      /<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^/]+)\/([^"]+)"[^>]*>[\s\S]*?<\/a>/
    );
    if (!linkMatch) continue;

    const owner = linkMatch[1];
    const repo = linkMatch[2].trim();
    const fullName = `${owner}/${repo}`;

    const descMatch = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch
      ? decodeHTML(descMatch[1].replace(/<[^>]+>/g, "").trim())
      : "";

    const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>([^<]+)</);
    const language = langMatch ? langMatch[1].trim() : null;

    const starsMatch = block.match(/([\d,]+)\s+stars?\s+today/i);
    const starsToday = starsMatch ? starsMatch[1] : null;

    repos.push({
      source: "GITHUB",
      owner,
      repo,
      fullName,
      url: `https://github.com/${fullName}`,
      description,
      language,
      taskType: null,
      starsToday,
      metricLabel: starsToday ? "stars today" : null,
      metricValue: starsToday,
      rank,
    });
  }

  if (repos.length === 0) {
    const seen = new Set<string>();
    let fallbackRank = 0;
    const repoLinkPattern = /<a[^>]*href="\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)"[^>]*data-hydro-click/g;

    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = repoLinkPattern.exec(html)) !== null) {
      const owner = linkMatch[1];
      const repo = linkMatch[2];
      const fullName = `${owner}/${repo}`;
      if (seen.has(fullName) || owner === "topics" || owner === "collections") continue;
      seen.add(fullName);
      fallbackRank++;
      repos.push({
        source: "GITHUB",
        owner,
        repo,
        fullName,
        url: `https://github.com/${fullName}`,
        description: "",
        language: null,
        taskType: null,
        starsToday: null,
        metricLabel: null,
        metricValue: null,
        rank: fallbackRank,
      });
    }
  }

  return repos.slice(0, 25);
}

function decodeHTML(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Backward-compatible re-exports
export type { DiscoveryItem as TrendingRepo } from "./types";
