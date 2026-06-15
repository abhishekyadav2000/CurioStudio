import type { RawLead } from "./types";
import { parseRssItems } from "./rss";

const FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
];

/** Fetch job listings from We Work Remotely RSS feeds. */
export async function fetchWWRLeads(): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  const seen = new Set<string>();

  for (const feedUrl of FEEDS) {
    const res = await fetch(feedUrl, {
      cache: "no-store",
      headers: { Accept: "application/rss+xml", "User-Agent": "CurioStudio/1.0" },
    });
    if (!res.ok) continue;

    const xml = await res.text();
    for (const item of parseRssItems(xml)) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      const companyMatch = item.title.match(/^([^:]+):\s*(.+)$/);
      const companyName = companyMatch?.[1]?.trim();
      const title = companyMatch?.[2]?.trim() ?? item.title;

      leads.push({
        title,
        url: item.url,
        source: "WWR",
        companyName,
        remote: true,
        postedAt: item.pubDate,
        description: item.description,
      });
      if (leads.length >= 45) break;
    }
    if (leads.length >= 45) break;
  }

  return leads;
}
