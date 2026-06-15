import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOutreachDraft } from "@/lib/leads/outreach";
import type { OutreachStatus } from "@prisma/client";

export async function GET() {
  const drafts = await prisma.outreachDraft.findMany({
    include: {
      jobLead: { select: { id: true, title: true, companyName: true } },
      contact: { select: { id: true, name: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ drafts });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { jobLeadId, contactId } = body;

  try {
    const draft = await generateOutreachDraft({ jobLeadId, contactId });
    return NextResponse.json({ draft }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outreach generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, status, subject, body: emailBody } = body as {
    id: string;
    status?: OutreachStatus;
    subject?: string;
    body?: string;
  };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const draft = await prisma.outreachDraft.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(subject ? { subject } : {}),
      ...(emailBody ? { body: emailBody } : {}),
    },
  });

  return NextResponse.json({ draft });
}
