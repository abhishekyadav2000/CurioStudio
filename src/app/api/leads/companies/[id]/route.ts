import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enrichCompany } from "@/lib/leads/enrich";
import { findContacts } from "@/lib/leads/contacts";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      jobLeads: { orderBy: { capturedAt: "desc" } },
      contacts: { orderBy: { createdAt: "desc" } },
      intel: { orderBy: { capturedAt: "desc" } },
    },
  });

  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ company });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const company = await prisma.company.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      website: body.website?.trim() || null,
      domain: body.domain?.trim() || null,
      githubOrg: body.githubOrg?.trim() || null,
      linkedinUrl: body.linkedinUrl?.trim() || null,
      industry: body.industry?.trim() || null,
      notes: body.notes?.trim() || null,
      greenhouseSlug: body.greenhouseSlug?.trim() || null,
      leverSlug: body.leverSlug?.trim() || null,
    },
  });
  return NextResponse.json({ company });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "findContacts") {
      const result = await findContacts(id);
      return NextResponse.json(result);
    }

    const enrichResult = await enrichCompany(id);
    if (body.findContacts !== false) {
      await findContacts(id);
    }

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        contacts: true,
        intel: { orderBy: { capturedAt: "desc" } },
        jobLeads: { orderBy: { capturedAt: "desc" }, take: 20 },
      },
    });

    return NextResponse.json({ enrichResult, company });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
