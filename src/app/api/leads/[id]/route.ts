import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LeadStatus } from "@prisma/client";
import { researchLead } from "@/lib/leads/research";

const VALID_STATUSES: LeadStatus[] = ["NEW", "RESEARCHING", "READY_OUTREACH", "APPLIED", "ARCHIVED"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await prisma.jobLead.findUnique({
    where: { id },
    include: {
      company: {
        include: {
          contacts: true,
          intel: { orderBy: { capturedAt: "desc" } },
          jobLeads: { orderBy: { capturedAt: "desc" }, take: 10 },
        },
      },
      outreach: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status, title, description } = body as {
    status?: LeadStatus;
    title?: string;
    description?: string;
  };

  const data: Record<string, unknown> = {};
  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
  }
  if (title) data.title = title;
  if (description !== undefined) data.description = description;

  const lead = await prisma.jobLead.update({
    where: { id },
    data,
    include: { company: true },
  });

  return NextResponse.json({ lead });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action === "research") {
    try {
      const result = await researchLead(id);
      const lead = await prisma.jobLead.findUnique({
        where: { id },
        include: { company: { include: { contacts: true, intel: true } } },
      });
      return NextResponse.json({ result, lead });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Research failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.jobLead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
