import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueUrls, processNextJob } from "@/lib/pipeline";

const JOB_STATUSES: JobStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

async function getCounts() {
  const [pending, processing, completed, failed] = await Promise.all([
    prisma.job.count({ where: { status: "PENDING" } }),
    prisma.job.count({ where: { status: "PROCESSING" } }),
    prisma.job.count({ where: { status: "COMPLETED" } }),
    prisma.job.count({ where: { status: "FAILED" } }),
  ]);
  return { pending, processing, completed, failed };
}

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    take: 50,
  });

  const counts = await getCounts();

  return NextResponse.json({ jobs, counts });
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";
    const status = searchParams.get("status");

    if (all) {
      const result = await prisma.job.deleteMany({});
      return NextResponse.json({ deleted: result.count });
    }

    if (status && JOB_STATUSES.includes(status as JobStatus)) {
      const result = await prisma.job.deleteMany({
        where: { status: status as JobStatus },
      });
      return NextResponse.json({ deleted: result.count, status });
    }

    return NextResponse.json(
      { error: "Provide ?all=true or ?status=PENDING|PROCESSING|COMPLETED|FAILED" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { urls, source = "manual" } = body;

  if (urls && Array.isArray(urls)) {
    const { jobIds, skipped } = await enqueueUrls(urls, source);
    return NextResponse.json({ jobIds, skipped });
  }

  if (body.action === "process") {
    const result = await processNextJob();
    return NextResponse.json(result);
  }

  if (body.action === "process-all") {
    const results = [];
    let processed = true;
    while (processed) {
      const result = await processNextJob();
      if (!result.processed) break;
      results.push(result);
      processed = result.processed;
    }
    return NextResponse.json({ results, total: results.length });
  }

  if (body.action === "mark-complete") {
    const ids = body.ids as string[] | undefined;
    const where = ids?.length
      ? { id: { in: [...new Set(ids)] }, status: { not: "PROCESSING" as JobStatus } }
      : { status: { in: ["PENDING", "FAILED"] as JobStatus[] } };

    const result = await prisma.job.updateMany({
      where,
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return NextResponse.json({ updated: result.count });
  }

  return NextResponse.json({ error: "Provide urls array or action" }, { status: 400 });
}
