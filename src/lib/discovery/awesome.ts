import type { DiscoveryItem } from "./types";

/** Recently updated entries from popular awesome-* GitHub lists. */
export async function fetchAwesomeLists(): Promise<DiscoveryItem[]> {
  const lists = [
    "sindresorhus/awesome",
    "awesome-selfhosted/awesome-selfhosted",
    "vinta/awesome-python",
    "enaqx/awesome-react",
    "fffaraz/awesome-cpp",
  ];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CurioStudio",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const items: DiscoveryItem[] = [];
  const seen = new Set<string>();

  for (const listFull of lists) {
    const res = await fetch(`https://api.github.com/repos/${listFull}/contents/README.md`, { headers });
    if (!res.ok) continue;
    const data = (await res.json()) as { content?: string; download_url?: string };
    let readme = "";
    if (data.content) {
      readme = Buffer.from(data.content, "base64").toString("utf-8");
    } else if (data.download_url) {
      const dl = await fetch(data.download_url, { headers });
      if (dl.ok) readme = await dl.text();
    }

    const linkRegex = /\[([^\]]+)\]\((https:\/\/github\.com\/[^)\s]+)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(readme)) !== null) {
      const title = match[1];
      const ghUrl = match[2].split("#")[0].split("?")[0];
      const parts = ghUrl.replace("https://github.com/", "").split("/");
      if (parts.length < 2) continue;
      const owner = parts[0];
      const repo = parts[1];
      const fullName = `${owner}/${repo}`;
      if (seen.has(fullName) || fullName === listFull) continue;
      seen.add(fullName);
      items.push({
        source: "AWESOME",
        owner,
        repo,
        fullName,
        url: `https://github.com/${fullName}`,
        description: title,
        language: null,
        taskType: `from ${listFull.split("/")[1]}`,
        starsToday: null,
        metricLabel: "list",
        metricValue: listFull.split("/")[1],
        rank: items.length + 1,
      });
      if (items.length >= 25) return items;
    }
  }

  return items;
}
