import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { regenerateInitialScript, regenerateMetadata } from "@/lib/production";
import { cacheResearchDocument } from "@/lib/research-document";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { includeMetadata?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // default full regen
  }

  await regenerateInitialScript(id);

  if (body.includeMetadata !== false) {
    await regenerateMetadata(id);
  }

  await cacheResearchDocument(id);

  const updated = await prisma.project.findUnique({
    where: { id },
    include: { content: true, youtubeMetadata: true },
  });

  return NextResponse.json({ project: updated, regenerated: true });
}
