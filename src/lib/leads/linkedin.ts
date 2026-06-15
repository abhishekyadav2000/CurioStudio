import type { RawLead } from "./types";
import { stripHtml } from "./scrape";

interface LinkedInCard {
  title?: string;
  company?: string;
  location?: string;
  link?: string;
}

/** Fetch jobs via LinkedIn guest search API (public, no auth). */
export async function fetchLinkedInLeads(): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  const seen = new Set<string>();

  const searches = [
    { keywords: "software engineer", location: "United States", remote: true },
    { keywords: "full stack developer", location: "United States", remote: true },
    { keywords: "backend engineer remote", location: "", remote: true },
  ];

  for (const search of searches) {
    const params = new URLSearchParams({
      keywords: search.keywords,
      location: search.location,
      start: "0",
      count: "25",
    });
    if (search.remote) params.set("f_WT", "2");

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (compatible; CurioStudio/1.0)",
      },
    });

    if (!res.ok) continue;

    const html = await res.text();
    const cards = parseLinkedInHtml(html);

    for (const card of cards) {
      if (!card.link || !card.title || seen.has(card.link)) continue;
      seen.add(card.link);
      leads.push({
        title: card.title,
        url: card.link,
        source: "LINKEDIN",
        companyName: card.company,
        location: card.location,
        remote: /remote/i.test((card.location ?? "") + card.title),
      });
      if (leads.length >= 50) break;
    }
    if (leads.length >= 50) break;
  }

  return leads;
}

function parseLinkedInHtml(html: string): LinkedInCard[] {
  const cards: LinkedInCard[] = [];

  const cardBlocks = html.match(/<li[\s\S]*?<\/li>/gi) ?? [];
  for (const block of cardBlocks) {
    const titleMatch = block.match(/base-search-card__title[^>]*>([^<]+)</i);
    const companyMatch = block.match(/base-search-card__subtitle[^>]*>([^<]+)</i);
    const locationMatch = block.match(/job-search-card__location[^>]*>([^<]+)</i);
    const linkMatch = block.match(/href=["']([^"']*\/jobs\/view\/[^"']+)["']/i);

    if (!titleMatch) continue;

    let link = linkMatch?.[1];
    if (link && !link.startsWith("http")) {
      link = `https://www.linkedin.com${link}`;
    }

    cards.push({
      title: stripHtml(titleMatch[1]),
      company: companyMatch ? stripHtml(companyMatch[1]) : undefined,
      location: locationMatch ? stripHtml(locationMatch[1]) : undefined,
      link,
    });
  }

  return cards;
}

/** Build a LinkedIn job search URL for a company (fallback when scraping blocked). */
export function linkedinSearchUrl(companyName: string): string {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(companyName)}&location=United%20States`;
}
