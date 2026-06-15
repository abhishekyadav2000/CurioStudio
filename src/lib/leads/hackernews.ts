import type { RawLead } from "./types";

interface HNAlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  story_text?: string;
  comment_text?: string;
  created_at?: string;
  author?: string;
}

interface HNAlgoliaResponse {
  hits: HNAlgoliaHit[];
}

const HIRING_PATTERNS = [
  /who is hiring/i,
  /we'?re hiring/i,
  /we are hiring/i,
  /hiring thread/i,
  /job opening/i,
  /open role/i,
  /open position/i,
];

function looksLikeJobPost(title: string, text?: string): boolean {
  const combined = `${title} ${text ?? ""}`;
  return HIRING_PATTERNS.some((p) => p.test(combined));
}

function extractCompanyFromTitle(title: string): string | undefined {
  const match = title.match(/^([^|–—-]+?)(?:\s*[|–—-]\s*|\s+is\s+hiring)/i);
  if (match) return match[1].trim();
  const hiringMatch = title.match(/^(.+?)\s+(?:is|are)\s+hiring/i);
  if (hiringMatch) return hiringMatch[1].trim();
  return undefined;
}

/** Fetch job-related posts from Hacker News via Algolia search. */
export async function fetchHackerNewsLeads(): Promise<RawLead[]> {
  const queries = [
    "who is hiring",
    "we're hiring",
    "we are hiring",
    "hiring engineers",
  ];

  const seen = new Set<string>();
  const leads: RawLead[] = [];

  for (const query of queries) {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story,comment&hitsPerPage=30`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) continue;

    const data = (await res.json()) as HNAlgoliaResponse;

    for (const hit of data.hits ?? []) {
      const title = hit.title ?? hit.comment_text?.slice(0, 120) ?? "";
      const text = hit.story_text ?? hit.comment_text ?? "";
      if (!title || !looksLikeJobPost(title, text)) continue;

      const leadUrl =
        hit.url ??
        `https://news.ycombinator.com/item?id=${hit.objectID}`;

      if (seen.has(leadUrl)) continue;
      seen.add(leadUrl);

      leads.push({
        title: title.slice(0, 300),
        url: leadUrl,
        source: "HN",
        companyName: extractCompanyFromTitle(title),
        postedAt: hit.created_at ? new Date(hit.created_at) : undefined,
        description: text.slice(0, 2000) || undefined,
      });

      if (leads.length >= 40) break;
    }
    if (leads.length >= 40) break;
  }

  return leads;
}
