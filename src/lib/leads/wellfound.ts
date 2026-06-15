import type { RawLead } from "./types";
import { fetchPage, stripHtml } from "./scrape";

interface WellfoundStartup {
  name?: string;
  slug?: string;
  high_concept?: string;
}

interface WellfoundJob {
  id: number;
  title: string;
  slug: string;
  location?: string;
  remote?: boolean;
  description?: string;
  created_at?: string;
  startup?: WellfoundStartup;
}

/** Fetch startup jobs from Wellfound (AngelList) public listings page. */
export async function fetchWellfoundLeads(): Promise<RawLead[]> {
  const leads: RawLead[] = [];
  const seen = new Set<string>();

  const html = await fetchPage("https://wellfound.com/role/l/software-engineer");
  if (!html) return leads;

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]) as {
        props?: { pageProps?: { listings?: WellfoundJob[]; jobs?: WellfoundJob[] } };
      };
      const jobs = data.props?.pageProps?.listings ?? data.props?.pageProps?.jobs ?? [];
      for (const job of jobs) {
        const url = `https://wellfound.com/jobs/${job.slug ?? job.id}`;
        if (seen.has(url)) continue;
        seen.add(url);
        leads.push({
          title: job.title,
          url,
          source: "WELLFOUND",
          companyName: job.startup?.name,
          location: job.location,
          remote: job.remote ?? /remote/i.test(job.location ?? ""),
          postedAt: job.created_at ? new Date(job.created_at) : undefined,
          description: job.description?.slice(0, 2000),
        });
        if (leads.length >= 40) break;
      }
      if (leads.length > 0) return leads;
    } catch {
      // fall through to HTML parse
    }
  }

  const anchorRe = /<a[^>]+href=["'](\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) {
    const path = match[1];
    const text = stripHtml(match[2]);
    if (!text || text.length < 5) continue;
    const url = `https://wellfound.com${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    leads.push({
      title: text.slice(0, 300),
      url,
      source: "WELLFOUND",
      remote: /remote/i.test(text),
    });
    if (leads.length >= 30) break;
  }

  return leads;
}
