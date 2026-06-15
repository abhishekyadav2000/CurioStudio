import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET(request: NextRequest) {
  await ensureSeeded();
  const slug = request.nextUrl.searchParams.get("slug");
  const category = request.nextUrl.searchParams.get("category");

  if (slug) {
    const doc = await prisma.docPage.findUnique({ where: { slug } });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ doc });
  }

  const where = category ? { category } : {};
  const docs = await prisma.docPage.findMany({
    where,
    orderBy: [{ category: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ docs });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, slug, title, category, content, order } = body;
  const doc = await prisma.docPage.update({
    where: id ? { id } : { slug },
    data: { title, category, content, order },
  });
  return NextResponse.json({ doc });
}
