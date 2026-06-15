import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProjectStatus } from "@prisma/client";
import { buildYouTubeCopyBundle, regenerateMetadata } from "@/lib/production";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { content: true, youtubeMetadata: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bundle = buildYouTubeCopyBundle(project);
  return NextResponse.json({ bundle, project: { id, status: project.status } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    title,
    description,
    tags,
    category,
    scheduledAt,
    privacyStatus,
    status,
    workflowStep,
    regenerate,
  } = body as {
    title?: string;
    description?: string;
    tags?: string[];
    category?: string;
    scheduledAt?: string | null;
    privacyStatus?: string;
    status?: ProjectStatus;
    workflowStep?: string;
    regenerate?: boolean;
  };

  const project = await prisma.project.findUnique({
    where: { id },
    include: { content: true, youtubeMetadata: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (regenerate) {
    await regenerateMetadata(id);
  }

  const scheduled = scheduledAt ? new Date(scheduledAt) : null;

  await prisma.youTubeMetadata.upsert({
    where: { projectId: id },
    create: {
      projectId: id,
      title: title ?? project.content?.youtubeTitle,
      description: description ?? project.content?.description,
      tags: JSON.stringify(tags ?? []),
      category: category ?? "28",
      scheduledAt: scheduled,
      privacyStatus: privacyStatus ?? "private",
    },
    update: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(tags !== undefined && { tags: JSON.stringify(tags) }),
      ...(category !== undefined && { category }),
      ...(scheduledAt !== undefined && { scheduledAt: scheduled }),
      ...(privacyStatus !== undefined && { privacyStatus }),
    },
  });

  if (title || description || tags) {
    await prisma.content.update({
      where: { projectId: id },
      data: {
        ...(title && { youtubeTitle: title }),
        ...(description && { description }),
        ...(tags && { hashtags: JSON.stringify(tags) }),
      },
    });
  }

  const updatedProject = await prisma.project.update({
    where: { id },
    data: {
      ...(scheduled && { scheduledPublishAt: scheduled }),
      ...(status && { status }),
      workflowStep: (workflowStep as import("@prisma/client").ProductionStep) ?? "PUBLISH",
    },
    include: { content: true, youtubeMetadata: true },
  });

  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID);

  return NextResponse.json({
    project: updatedProject,
    bundle: buildYouTubeCopyBundle(updatedProject),
    youtubeOAuthAvailable: googleConfigured,
    youtubeOAuthUrl: googleConfigured
      ? `/api/youtube/auth?projectId=${id}`
      : null,
  });
}
