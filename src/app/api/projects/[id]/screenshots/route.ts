import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveScreenshot, parseScreenshots } from "@/lib/production/uploads";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { screenshots: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ screenshots: parseScreenshots(project.screenshots) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  if (!files.length) {
    const single = formData.get("file") as File | null;
    if (single) files.push(single);
  }
  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const existing = parseScreenshots(project.screenshots);
  const uploaded = [];
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) continue;
    uploaded.push(await saveScreenshot(id, file));
  }

  const all = [...existing, ...uploaded];
  await prisma.project.update({
    where: { id },
    data: { screenshots: JSON.stringify(all), workflowStep: "IMPORT" },
  });

  return NextResponse.json({ screenshots: all, uploaded: uploaded.length });
}
