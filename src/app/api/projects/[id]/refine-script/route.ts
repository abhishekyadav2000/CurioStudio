import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refineScriptFromSlides, saveScript } from "@/lib/production";

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
    return NextResponse.json({ error: "Content not found — generate script first" }, { status: 404 });
  }

  let body: { script?: string; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    // refine mode
  }

  if (body.script && body.action === "save") {
    await saveScript(id, body.script, "refined");
    return NextResponse.json({ refinedScript: body.script, saved: true });
  }

  const refinedScript = await refineScriptFromSlides(id);
  const updated = await prisma.content.findUnique({ where: { projectId: id } });
  return NextResponse.json({
    refinedScript,
    recordingOutline: updated?.recordingOutline,
  });
}
