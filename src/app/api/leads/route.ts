import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LeadSource, LeadStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as LeadStatus | null;
  const source = searchParams.get("source") as LeadSource | null;
  const companyId = searchParams.get("companyId");
  const q = searchParams.get("q");
  const minRelevance = parseInt(searchParams.get("minRelevance") ?? "0", 10);
  const postedWithin = parseInt(searchParams.get("postedWithin") ?? "0", 10);
  const remoteOnly = searchParams.get("remoteOnly") === "true";
  const fortune100 = searchParams.get("fortune100") === "true";
  const shortlist = searchParams.get("shortlist") === "true";
  const roles = searchParams.get("roles")?.split(",").filter(Boolean) ?? [];

  const where: Record<string, unknown> = {
    status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] },
  };
  if (status) where.status = status;
  if (source) where.source = source;
  if (companyId) where.companyId = companyId;
  if (minRelevance > 0) where.relevanceScore = { gte: minRelevance };
  if (remoteOnly) where.remote = true;
  if (fortune100) where.isFortune100 = true;
  if (postedWithin > 0) {
    const cutoff = new Date(Date.now() - postedWithin * 24 * 60 * 60 * 1000);
    where.OR = [
      { postedAt: { gte: cutoff } },
      { postedAt: null, capturedAt: { gte: cutoff } },
    ];
  }
  if (q) {
    where.AND = [
      {
        OR: [
          { title: { contains: q } },
          { companyName: { contains: q } },
          { description: { contains: q } },
        ],
      },
    ];
  }
  if (roles.length > 0) {
    where.AND = [
      ...((where.AND as unknown[]) ?? []),
      {
        OR: roles.map((role) => ({ title: { contains: role } })),
      },
    ];
  }

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const limit = shortlist ? 50 : Math.min(parseInt(searchParams.get("limit") ?? "200", 10), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const [leads, settings, totalOpen, newToday, companiesTracked, contactsFound, totalMatching] =
    await Promise.all([
      prisma.jobLead.findMany({
        where,
        include: {
          company: {
            include: {
              intel: { orderBy: { capturedAt: "desc" }, take: 5 },
              contacts: { take: 5 },
            },
          },
        },
        orderBy: [{ relevanceScore: "desc" }, { postedAt: "desc" }, { capturedAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.appSettings.findUnique({ where: { id: "default" } }),
      prisma.jobLead.count({ where: { status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] } } }),
      prisma.jobLead.count({ where: { status: "NEW", capturedAt: { gte: todayStart } } }),
      prisma.company.count(),
      prisma.contact.count(),
      prisma.jobLead.count({ where }),
    ]);

  let preferences = null;
  try {
    preferences = settings?.jobPreferences ? JSON.parse(settings.jobPreferences) : null;
  } catch {
    preferences = null;
  }

  return NextResponse.json({
    leads,
    total: totalMatching,
    limit,
    offset,
    lastScanAt: settings?.lastLeadsScanAt ?? null,
    scanSettings: {
      leadsAutoScanIntervalMinutes: settings?.leadsAutoScanIntervalMinutes ?? 5,
      leadsMaxAgeDays: settings?.leadsMaxAgeDays ?? 45,
      leadsAutoScanEnabled: settings?.leadsAutoScanEnabled ?? true,
    },
    preferences,
    stats: { totalOpen, newToday, companiesTracked, contactsFound },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, url, companyName, location, remote, description, source = "MANUAL" } = body;

  if (!title?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "title and url are required" }, { status: 400 });
  }

  const normalizedUrl = url.trim();
  const existing = await prisma.jobLead.findUnique({ where: { url: normalizedUrl } });
  if (existing) {
    return NextResponse.json({ error: "Lead with this URL already exists", lead: existing }, { status: 409 });
  }

  let companyId: string | null = null;
  if (companyName?.trim()) {
    const name = companyName.trim();
    const co = await prisma.company.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    companyId = co.id;
  }

  const lead = await prisma.jobLead.create({
    data: {
      title: title.trim(),
      url: normalizedUrl,
      source: source as LeadSource,
      companyId,
      companyName: companyName?.trim(),
      location: location?.trim(),
      remote: remote ?? undefined,
      description: description?.trim(),
      status: "NEW",
    },
    include: { company: true },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
