import type { DiscoveryItem } from "./types";

interface NpmSearchHit {
  package: {
    name: string;
    description?: string;
    links?: { npm?: string; repository?: string };
    publisher?: { username?: string };
  };
  score?: { final?: number };
}

/** Trending npm packages via registry search (no auth). */
export async function fetchNpmTrending(): Promise<DiscoveryItem[]> {
  const queries = ["keywords:react", "keywords:ai", "keywords:cli", "keywords:typescript"];
  const seen = new Set<string>();
  const items: DiscoveryItem[] = [];

  for (const q of queries) {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=8`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "CurioStudio/1.0" },
      cache: "no-store",
    });
    if (!res.ok) continue;

    const data = (await res.json()) as { objects?: NpmSearchHit[] };
    for (const hit of data.objects ?? []) {
      const name = hit.package.name;
      if (seen.has(name)) continue;
      seen.add(name);

      const repoUrl = normalizeRepoUrl(hit.package.links?.repository);
      items.push({
        source: "NPM",
        owner: hit.package.publisher?.username ?? "npm",
        repo: name,
        fullName: name,
        url: repoUrl ?? `https://www.npmjs.com/package/${name}`,
        description: hit.package.description ?? "",
        language: "JavaScript",
        taskType: "npm package",
        starsToday: null,
        metricLabel: "registry score",
        metricValue: hit.score?.final != null ? hit.score.final.toFixed(2) : null,
        rank: items.length + 1,
      });
      if (items.length >= 25) return items;
    }
  }

  return items;
}

function normalizeRepoUrl(raw?: string): string | null {
  if (!raw) return null;
  if (raw.startsWith("git+")) return raw.replace(/^git\+/, "").replace(/\.git$/, "");
  if (raw.startsWith("github:")) return `https://github.com/${raw.slice(7)}`;
  if (raw.startsWith("http")) return raw.replace(/\.git$/, "");
  return null;
}
