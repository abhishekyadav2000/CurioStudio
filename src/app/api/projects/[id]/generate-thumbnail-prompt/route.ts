import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateThumbnailPrompt, regenerateMetadata } from "@/lib/production";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { content: true },
  });
  if (!project?.content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  let body: { regenerateMetadata?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // default thumbnail only
  }

  if (body.regenerateMetadata) {
    await regenerateMetadata(id);
  }

  const result = await generateThumbnailPrompt(id);
  return NextResponse.json(result);
}
