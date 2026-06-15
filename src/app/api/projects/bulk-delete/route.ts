import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body as { ids?: string[] };

    if (!ids?.length || !Array.isArray(ids)) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }

    const uniqueIds = [...new Set(ids.filter((id) => typeof id === "string" && id.trim()))];
    if (!uniqueIds.length) {
      return NextResponse.json({ error: "No valid ids provided" }, { status: 400 });
    }

    const result = await prisma.project.deleteMany({
      where: { id: { in: uniqueIds } },
    });

    return NextResponse.json({ deleted: result.count, ids: uniqueIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
