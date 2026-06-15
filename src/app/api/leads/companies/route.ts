import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FORTUNE_COMPANY_NAMES } from "@/lib/leads/fortune-careers";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fortune100Only = searchParams.get("fortune100") === "true";
  const maxAgeDays = parseInt(searchParams.get("maxAgeDays") ?? "45", 10);
  const freshCutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { jobLeads: true, intel: true, contacts: true } },
      jobLeads: {
        where: {
          status: { in: ["NEW", "RESEARCHING", "READY_OUTREACH"] },
          OR: [
            { postedAt: { gte: freshCutoff } },
            { postedAt: null, capturedAt: { gte: freshCutoff } },
          ],
        },
        select: { id: true, relevanceScore: true },
      },
    },
    take: fortune100Only ? 100 : 200,
  });

  const enriched = companies
    .map((c) => {
      const freshRoles = c.jobLeads.length;
      const avgRelevance =
        c.jobLeads.length > 0
          ? Math.round(c.jobLeads.reduce((s, j) => s + j.relevanceScore, 0) / c.jobLeads.length)
          : 0;
      const isFortune100 = FORTUNE_COMPANY_NAMES.has(c.name);
      return {
        ...c,
        freshRoleCount: freshRoles,
        avgRelevance,
        isFortune100,
        newLeadCount: freshRoles,
        jobLeads: undefined,
      };
    })
    .filter((c) => !fortune100Only || c.isFortune100)
    .sort((a, b) => {
      if (b.freshRoleCount !== a.freshRoleCount) return b.freshRoleCount - a.freshRoleCount;
      return b.avgRelevance - a.avgRelevance;
    });

  return NextResponse.json({ companies: enriched });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, website, githubOrg, industry, notes, greenhouseSlug, leverSlug } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        website: website?.trim() || null,
        githubOrg: githubOrg?.trim() || null,
        industry: industry?.trim() || null,
        notes: notes?.trim() || null,
        greenhouseSlug: greenhouseSlug?.trim() || null,
        leverSlug: leverSlug?.trim() || null,
      },
    });
    return NextResponse.json({ company }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Company already exists or invalid data" }, { status: 409 });
  }
}
