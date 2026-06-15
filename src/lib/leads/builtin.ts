import type { RawLead } from "./types";
import { fetchPage, stripHtml } from "./scrape";

const CITIES = [
  { slug: "remote", label: "Remote" },
  { slug: "san-francisco", label: "San Francisco" },
  { slug: "new-york", label: "New York" },
  { slug: "austin", label: "Austin" },
  { slug: "seattle", label: "Seattle" },
];

/** Fetch tech jobs from Built In city job boards. */
export async function fetchBuiltInLeads(): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  const seen = new Set<string>();

  for (const city of CITIES) {
    const pageUrl = `https://builtin.com/jobs?city=${city.slug}&search=Software+Engineer`;
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const anchorRe = /<a[^>]+href=["'](\/job\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of html.matchAll(anchorRe)) {
      const path = match[1];
      const text = stripHtml(match[2]);
      if (!text || text.length < 8) continue;
      const url = `https://builtin.com${path}`;
      if (seen.has(url)) continue;
      seen.add(url);

      leads.push({
        title: text.slice(0, 300),
        url,
        source: "BUILTIN",
        location: city.label,
        remote: city.slug === "remote" || /remote/i.test(text),
      });
      if (leads.length >= 40) break;
    }
    if (leads.length >= 40) break;
  }

  return leads;
}
