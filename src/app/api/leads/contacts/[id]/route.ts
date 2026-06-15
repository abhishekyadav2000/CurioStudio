import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: body.name?.trim(),
      title: body.title?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      linkedinUrl: body.linkedinUrl?.trim() || null,
      twitterUrl: body.twitterUrl?.trim() || null,
      notes: body.notes?.trim() || null,
      confidence: body.confidence,
    },
    include: { company: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ contact });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
