import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { jobLeads: true, updates: true } },
      jobLeads: {
        where: { status: "NEW" },
        select: { id: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const enriched = companies.map((c) => ({
    ...c,
    newLeadCount: c.jobLeads.length,
    jobLeads: undefined,
  }));

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
