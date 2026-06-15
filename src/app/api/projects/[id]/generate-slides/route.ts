import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSlides, saveSlides } from "@/lib/production";
import type { PresentationSlide } from "@/lib/content";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { content: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { slides?: PresentationSlide[]; action?: string } = {};
  try {
    body = await request.json();
  } catch {
    // generate mode
  }

  if (body.slides && body.action === "save") {
    await saveSlides(id, body.slides);
    return NextResponse.json({ slides: body.slides, saved: true });
  }

  const slides = await generateSlides(id);
  return NextResponse.json({ slides });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { slides } = (await request.json()) as { slides: PresentationSlide[] };
  if (!slides?.length) {
    return NextResponse.json({ error: "slides required" }, { status: 400 });
  }
  await saveSlides(id, slides);
  return NextResponse.json({ slides, saved: true });
}
