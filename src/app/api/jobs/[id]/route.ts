import { NextRequest, NextResponse } from "next/server";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status?: string };

    if (!status || !["PENDING", "COMPLETED"].includes(status)) {
      return NextResponse.json(
        { error: "status must be PENDING or COMPLETED" },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status === "PROCESSING") {
      return NextResponse.json(
        { error: "Cannot change status while processing" },
        { status: 400 }
      );
    }

    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: status as JobStatus,
        completedAt: status === "COMPLETED" ? new Date() : null,
        ...(status === "PENDING" ? { error: null } : {}),
      },
    });

    return NextResponse.json({ job: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
