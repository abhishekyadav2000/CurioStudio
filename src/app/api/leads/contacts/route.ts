import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ContactConfidence } from "@prisma/client";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");

  const contacts = await prisma.contact.findMany({
    where: companyId ? { companyId } : undefined,
    include: {
      company: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyId, name, title, email, phone, linkedinUrl, twitterUrl, source, confidence, notes } = body;

  if (!companyId || !name?.trim()) {
    return NextResponse.json({ error: "companyId and name are required" }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      companyId,
      name: name.trim(),
      title: title?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      linkedinUrl: linkedinUrl?.trim() || null,
      twitterUrl: twitterUrl?.trim() || null,
      source: source?.trim() || "manual",
      confidence: (confidence as ContactConfidence) ?? "LOW",
      notes: notes?.trim() || null,
    },
    include: { company: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
