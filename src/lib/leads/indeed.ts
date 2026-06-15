import type { RawLead } from "./types";
import { parseRssItems } from "./rss";

const QUERIES = [
  { q: "software+engineer", l: "remote" },
  { q: "full+stack+developer", l: "remote" },
  { q: "backend+engineer", l: "remote" },
];

/** Fetch job listings from Indeed public RSS feeds (no API key). */
export async function fetchIndeedLeads(): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  const seen = new Set<string>();

  for (const { q, l } of QUERIES) {
    const url = `https://rss.indeed.com/rss?q=${q}&l=${l}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "CurioStudio/1.0" },
    });
    if (!res.ok) continue;

    const xml = await res.text();
    for (const item of parseRssItems(xml)) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      leads.push({
        title: item.title,
        url: item.url,
        source: "INDEED",
        remote: /remote/i.test(item.title + (item.description ?? "")),
        postedAt: item.pubDate,
        description: item.description,
      });
      if (leads.length >= 40) break;
    }
    if (leads.length >= 40) break;
  }

  return leads;
}
