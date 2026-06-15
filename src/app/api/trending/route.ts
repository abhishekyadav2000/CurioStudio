import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  syncTrendingToDb,
  parseTrendingSource,
  sourceExternalUrl,
} from "@/lib/discovery";
import { enqueueUrls } from "@/lib/pipeline";
import type { DiscoverySource } from "@prisma/client";

function parseFilters(request: NextRequest) {
  const source = parseTrendingSource(request.nextUrl.searchParams.get("source"));
  const period = (request.nextUrl.searchParams.get("period") || "daily") as "daily" | "weekly";
  const spokenLanguage = request.nextUrl.searchParams.get("spoken") ?? "en";
  const language = request.nextUrl.searchParams.get("language") ?? "";
  const kind = (request.nextUrl.searchParams.get("kind") || "spaces") as "spaces" | "models";
  return { source, period, spokenLanguage, language, kind };
}

export async function GET(request: NextRequest) {
  const { source, period, spokenLanguage, language, kind } = parseFilters(request);
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (refresh) {
    try {
      await syncTrendingToDb(source, { period, spokenLanguage, language, kind });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      return NextResponse.json({ error: message, source }, { status: 500 });
    }
  }

  const entries = await prisma.trendingEntry.findMany({
    where: { source, period, spokenLanguage, progLanguage: language },
    orderBy: { rank: "asc" },
  });

  const urls = entries.map((e) => e.url);
  const pendingJobs =
    urls.length > 0
      ? await prisma.job.findMany({
          where: { url: { in: urls }, status: { in: ["PENDING", "PROCESSING"] } },
          select: { url: true },
        })
      : [];
  const queuedUrls = new Set(pendingJobs.map((j) => j.url));

  const enriched = entries.map((e) => ({
    ...e,
    queued: queuedUrls.has(e.url),
  }));

  return NextResponse.json({
    entries: enriched,
    source,
    fetchedAt: entries[0]?.fetchedAt ?? null,
    count: entries.length,
    filters: { period, spokenLanguage, language, kind },
    externalUrl: sourceExternalUrl(source, { period, spokenLanguage, language, kind }),
    githubUrl: source === "GITHUB" ? sourceExternalUrl("GITHUB", { period, spokenLanguage, language }) : undefined,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    action,
    urls,
    count,
    source: rawSource = "github",
    period = "daily",
    spokenLanguage = "en",
    language = "",
    kind = "spaces",
  } = body;

  const source = parseTrendingSource(rawSource) as DiscoverySource;

  if (action === "refresh") {
    try {
      const items = await syncTrendingToDb(source, { period, spokenLanguage, language, kind });
      return NextResponse.json({ synced: items.length, entries: items, source });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      return NextResponse.json({ error: message, source }, { status: 500 });
    }
  }

  if (action === "queue") {
    let toQueue: string[] = urls ?? [];

    if (!toQueue.length && count) {
      const entries = await prisma.trendingEntry.findMany({
        where: { source, period, spokenLanguage, progLanguage: language, imported: false },
        orderBy: { rank: "asc" },
        take: count * 2,
      });
      const pendingJobs = await prisma.job.findMany({
        where: {
          url: { in: entries.map((e) => e.url) },
          status: { in: ["PENDING", "PROCESSING"] },
        },
        select: { url: true },
      });
      const queuedUrls = new Set(pendingJobs.map((j) => j.url));
      const existingProjects = await prisma.project.findMany({
        where: { url: { in: entries.map((e) => e.url) } },
        select: { url: true },
      });
      const projectUrls = new Set(existingProjects.map((p) => p.url));
      toQueue = entries
        .filter((e) => !queuedUrls.has(e.url) && !projectUrls.has(e.url))
        .slice(0, count)
        .map((e) => e.url);
    }

    const { jobIds, skipped } = await enqueueUrls(toQueue, `trending:${source.toLowerCase()}`);
    return NextResponse.json({ jobIds, skipped, queued: jobIds.length, source });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
