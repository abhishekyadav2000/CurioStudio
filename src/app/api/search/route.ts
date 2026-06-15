import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET(request: NextRequest) {
  await ensureSeeded();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results: {
    type: "project" | "doc" | "slot" | "sop";
    id: string;
    title: string;
    subtitle?: string;
    href: string;
  }[] = [];

  const [projects, docs, slots, sops] = await Promise.all([
    prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { owner: { contains: q } },
        ],
      },
      take: 8,
      select: { id: true, name: true, status: true },
    }),
    prisma.docPage.findMany({
      where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      take: 5,
      select: { id: true, slug: true, title: true, category: true },
    }),
    prisma.contentSlot.findMany({
      where: { title: { contains: q } },
      take: 5,
      select: { id: true, title: true, scheduledAt: true, platform: true },
    }),
    prisma.sopDocument.findMany({
      where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      take: 5,
      select: { id: true, slug: true, title: true },
    }),
  ]);

  for (const p of projects) {
    results.push({
      type: "project",
      id: p.id,
      title: p.name ?? "Untitled",
      subtitle: p.status,
      href: `/projects/${p.id}`,
    });
  }
  for (const d of docs) {
    results.push({
      type: "doc",
      id: d.id,
      title: d.title,
      subtitle: d.category,
      href: `/docs/${d.slug}`,
    });
  }
  for (const s of slots) {
    results.push({
      type: "slot",
      id: s.id,
      title: s.title,
      subtitle: `${s.platform} · ${new Date(s.scheduledAt).toLocaleDateString()}`,
      href: "/calendar",
    });
  }
  for (const s of sops) {
    results.push({
      type: "sop",
      id: s.id,
      title: s.title,
      subtitle: "SOP",
      href: `/processes?slug=${s.slug}`,
    });
  }

  return NextResponse.json({ results });
}
