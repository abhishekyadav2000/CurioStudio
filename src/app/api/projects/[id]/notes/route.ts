import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Note content is required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: { projectId: id, content },
  });

  return NextResponse.json(note);
}
