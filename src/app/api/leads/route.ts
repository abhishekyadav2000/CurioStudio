import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LeadSource, LeadStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as LeadStatus | null;
  const source = searchParams.get("source") as LeadSource | null;
  const companyId = searchParams.get("companyId");
  const q = searchParams.get("q");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (source) where.source = source;
  if (companyId) where.companyId = companyId;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { companyName: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [leads, settings, totalOpen, newToday, companiesTracked, contactsFound] = await Promise.all([
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
      orderBy: [{ capturedAt: "desc" }],
    }),
    prisma.appSettings.findUnique({ where: { id: "default" } }),
    prisma.jobLead.count({ where: { status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] } } }),
    prisma.jobLead.count({ where: { status: "NEW", capturedAt: { gte: todayStart } } }),
    prisma.company.count(),
    prisma.contact.count(),
  ]);

  return NextResponse.json({
    leads,
    lastScanAt: settings?.lastLeadsScanAt ?? null,
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
