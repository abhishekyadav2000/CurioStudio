const FETCH_HEADERS: HeadersInit = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "CurioStudio/1.0 (lead intelligence)",
};

export async function fetchPage(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractMeta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(re);
  if (match) return match[1].trim();
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`,
    "i"
  );
  return re2.exec(html)?.[1]?.trim();
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

export function extractEmails(html: string): string[] {
  const emails = new Set<string>();
  const mailto = html.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
  for (const m of mailto) emails.add(m[1].toLowerCase());

  const plain = html.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g);
  for (const m of plain) {
    const email = m[1].toLowerCase();
    if (!email.endsWith(".png") && !email.endsWith(".jpg")) emails.add(email);
  }
  return [...emails].slice(0, 20);
}

export function extractPeople(html: string): { name: string; title?: string }[] {
  const people: { name: string; title?: string }[] = [];
  const headingBlocks = html.matchAll(
    /<h[234][^>]*>([^<]{2,60})<\/h[234]>\s*(?:<p[^>]*>([^<]{5,120})<\/p>)?/gi
  );
  for (const m of headingBlocks) {
    const name = stripHtml(m[1]);
    if (name.length < 3 || /\d/.test(name)) continue;
    if (/about|team|careers|contact|news|blog/i.test(name)) continue;
    people.push({ name, title: m[2] ? stripHtml(m[2]).slice(0, 120) : undefined });
  }
  return people.slice(0, 15);
}

export function guessDomain(website?: string | null, name?: string): string | undefined {
  if (website) {
    try {
      const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
      return host.replace(/^www\./, "");
    } catch {
      // fall through
    }
  }
  if (name) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (slug.length >= 3) return `${slug}.com`;
  }
  return undefined;
}

export function normalizeUrl(base: string, path: string): string {
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}

export async function fetchCompanyPages(baseUrl: string): Promise<{ url: string; html: string }[]> {
  const origin = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const paths = ["", "/about", "/about-us", "/company", "/careers", "/jobs", "/team", "/contact"];
  const pages: { url: string; html: string }[] = [];

  for (const path of paths) {
    const url = path ? normalizeUrl(origin, path) : origin;
    const html = await fetchPage(url);
    if (html && html.length > 200) pages.push({ url, html });
  }

  return pages;
}
