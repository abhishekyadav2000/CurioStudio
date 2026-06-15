import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import type { QuadrantType } from "@prisma/client";

const VALID_QUADRANTS: QuadrantType[] = ["DELEGATE", "DO_NOW", "DO_LATER", "PLAN"];

export async function GET() {
  await ensureSeeded();
  const items = await prisma.quadrantItem.findMany({
    orderBy: [{ quadrant: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  await ensureSeeded();
  const body = await request.json();
  const { quadrant, text } = body;

  if (!quadrant || !VALID_QUADRANTS.includes(quadrant)) {
    return NextResponse.json({ error: "Valid quadrant required" }, { status: 400 });
  }
  if (!text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const maxOrder = await prisma.quadrantItem.aggregate({
    where: { quadrant: quadrant as QuadrantType },
    _max: { order: true },
  });

  const item = await prisma.quadrantItem.create({
    data: {
      quadrant: quadrant as QuadrantType,
      text: text.trim(),
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ item });
}

export async function PATCH(request: NextRequest) {
  await ensureSeeded();
  const body = await request.json();
  const { id, text, order } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const data: { text?: string; order?: number } = {};
  if (text !== undefined) data.text = text.trim();
  if (order !== undefined) data.order = order;

  const item = await prisma.quadrantItem.update({
    where: { id },
    data,
  });

  return NextResponse.json({ item });
}

export async function DELETE(request: NextRequest) {
  await ensureSeeded();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await prisma.quadrantItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
