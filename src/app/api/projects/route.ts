import { NextRequest, NextResponse } from "next/server";
import { enqueueUrls } from "@/lib/pipeline";
import { prisma } from "@/lib/db";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      source: true,
      tags: true,
      workflowStep: true,
      scheduledPublishAt: true,
      updatedAt: true,
      stars: true,
    },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, runFullPipeline = true } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!runFullPipeline) {
      const { jobIds } = await enqueueUrls([url], "manual");
      return NextResponse.json({ queued: true, jobId: jobIds[0] });
    }

    // Queue and process immediately for single URL (backward compat)
    const { jobIds } = await enqueueUrls([url], "manual");
    const { processNextJob } = await import("@/lib/pipeline");
    const result = await processNextJob();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const { prisma } = await import("@/lib/db");
    const project = await prisma.project.findUnique({
      where: { id: result.projectId },
      include: { scan: true, sandbox: true, scorecard: true, content: true, notes: true },
    });

    return NextResponse.json({ project, jobId: jobIds[0] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
