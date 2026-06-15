import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";

function parseRoadmapItems(): { id: number; phase: number; title: string }[] {
  try {
    const mdPath = join(process.cwd(), "docs", "INSIDER_TRACKER_ROADMAP.md");
    const content = readFileSync(mdPath, "utf-8");
    const items: { id: number; phase: number; title: string }[] = [];
    let phase = 1;
    for (const line of content.split("\n")) {
      const phaseMatch = line.match(/^## Phase (\d+)/);
      if (phaseMatch) phase = parseInt(phaseMatch[1], 10);
      const itemMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*/);
      if (itemMatch) {
        items.push({ id: parseInt(itemMatch[1], 10), phase, title: itemMatch[2] });
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  let progress: Record<string, boolean> = {};
  try {
    progress = settings?.roadmapProgress ? JSON.parse(settings.roadmapProgress) : {};
  } catch {
    progress = {};
  }

  const items = parseRoadmapItems();
  const phases = [1, 2, 3, 4, 5].map((p) => ({
    phase: p,
    items: items.filter((i) => i.phase === p),
    completed: items.filter((i) => i.phase === p && progress[String(i.id)]).length,
    total: items.filter((i) => i.phase === p).length,
  }));

  return NextResponse.json({ items, progress, phases });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { itemId, completed } = body as { itemId: number; completed: boolean };

  if (typeof itemId !== "number") {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  let progress: Record<string, boolean> = {};
  try {
    progress = settings?.roadmapProgress ? JSON.parse(settings.roadmapProgress) : {};
  } catch {
    progress = {};
  }

  progress[String(itemId)] = completed;

  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", roadmapProgress: JSON.stringify(progress) },
    update: { roadmapProgress: JSON.stringify(progress) },
  });

  return NextResponse.json({ ok: true, progress });
}
