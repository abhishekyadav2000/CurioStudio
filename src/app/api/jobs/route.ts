import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueUrls, processNextJob } from "@/lib/pipeline";

export async function GET() {
  const jobs = await prisma.job.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    take: 50,
  });

  const counts = {
    pending: jobs.filter((j) => j.status === "PENDING").length,
    processing: jobs.filter((j) => j.status === "PROCESSING").length,
    completed: await prisma.job.count({ where: { status: "COMPLETED" } }),
    failed: await prisma.job.count({ where: { status: "FAILED" } }),
  };

  return NextResponse.json({ jobs, counts });
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

  return NextResponse.json({ error: "Provide urls array or action" }, { status: 400 });
}
