/** Parse RSS/Atom feed items into title, url, description, date. */
export function parseRssItems(xml: string): {
  title: string;
  url: string;
  description?: string;
  pubDate?: Date;
}[] {
  const items: { title: string; url: string; description?: string; pubDate?: Date }[] = [];

  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];

  for (const block of itemBlocks) {
    const title = extractTag(block, "title");
    const link =
      extractTag(block, "link") ??
      block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
    if (!title || !link) continue;

    const description =
      extractTag(block, "description") ??
      extractTag(block, "summary") ??
      extractTag(block, "content");
    const pubStr = extractTag(block, "pubDate") ?? extractTag(block, "published") ?? extractTag(block, "updated");

    items.push({
      title: decodeEntities(title).slice(0, 300),
      url: link.trim(),
      description: description ? decodeEntities(stripCdata(description)).slice(0, 2000) : undefined,
      pubDate: pubStr ? new Date(pubStr) : undefined,
    });
  }

  return items;
}

function extractTag(xml: string, tag: string): string | undefined {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i").exec(xml);
  if (cdata) return cdata[1].trim();
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return plain?.[1]?.trim();
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
