import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET(request: NextRequest) {
  await ensureSeeded();
  const slug = request.nextUrl.searchParams.get("slug");
  if (slug) {
    const doc = await prisma.sopDocument.findUnique({ where: { slug } });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ sop: doc });
  }
  const sops = await prisma.sopDocument.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  return NextResponse.json({ sops });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, slug, title, category, content, order } = body;
  if (!id && !slug) return NextResponse.json({ error: "id or slug required" }, { status: 400 });

  const sop = await prisma.sopDocument.update({
    where: id ? { id } : { slug },
    data: { title, category, content, order },
  });
  return NextResponse.json({ sop });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, title, category, content, order } = body;
  const sop = await prisma.sopDocument.create({
    data: { slug, title, category, content, order: order ?? 99 },
  });
  return NextResponse.json({ sop });
}
