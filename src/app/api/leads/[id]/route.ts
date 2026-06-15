import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LeadStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body as { status?: LeadStatus };

  if (!status || !["NEW", "APPLIED", "ARCHIVED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const lead = await prisma.jobLead.update({
    where: { id },
    data: { status },
    include: { company: true },
  });

  return NextResponse.json({ lead });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.jobLead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
