import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { generateRepurposePosts } from "@/lib/marketing/repurpose";

export async function GET(request: NextRequest) {
  await ensureSeeded();
  const projectId = request.nextUrl.searchParams.get("projectId");

  const [campaigns, hashtagSets, analytics] = await Promise.all([
    prisma.marketingCampaign.findMany({
      where: projectId ? { projectId } : undefined,
      include: { project: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.hashtagSet.findMany({ orderBy: { name: "asc" } }),
    prisma.analyticsEntry.findMany({
      include: { project: { select: { id: true, name: true } } },
      orderBy: { recordedAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ campaigns, hashtagSets, analytics });
}

export async function POST(request: NextRequest) {
  await ensureSeeded();
  const body = await request.json();
  const { action } = body;

  if (action === "campaign") {
    const campaign = await prisma.marketingCampaign.create({
      data: {
        name: body.name,
        projectId: body.projectId,
        platforms: JSON.stringify(body.platforms ?? ["YOUTUBE"]),
        hashtags: body.hashtags ? JSON.stringify(body.hashtags) : null,
        linkedinPost: body.linkedinPost,
        twitterThread: body.twitterThread,
        emailNewsletter: body.emailNewsletter,
        status: body.status ?? "DRAFT",
        launchDate: body.launchDate ? new Date(body.launchDate) : null,
        notes: body.notes,
      },
    });
    return NextResponse.json({ campaign });
  }

  if (action === "hashtag-set") {
    const set = await prisma.hashtagSet.create({
      data: {
        name: body.name,
        tags: JSON.stringify(body.tags ?? []),
        platform: body.platform,
      },
    });
    return NextResponse.json({ hashtagSet: set });
  }

  if (action === "analytics") {
    const entry = await prisma.analyticsEntry.create({
      data: {
        projectId: body.projectId,
        platform: body.platform,
        views: body.views ?? 0,
        ctr: body.ctr,
        likes: body.likes,
        notes: body.notes,
      },
    });
    return NextResponse.json({ entry });
  }

  if (action === "repurpose") {
    const { projectId } = body;
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    const posts = await generateRepurposePosts(projectId);
    return NextResponse.json({ posts });
  }

  if (action === "from-content") {
    const { projectId } = body;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { content: true },
    });
    if (!project?.content) {
      return NextResponse.json({ error: "No content for project" }, { status: 404 });
    }
    const c = project.content;
    const campaign = await prisma.marketingCampaign.create({
      data: {
        name: `${project.name ?? "Project"} — Launch Pack`,
        projectId,
        platforms: JSON.stringify(["YOUTUBE", "LINKEDIN", "TWITTER", "SHORTS"]),
        hashtags: c.hashtags,
        linkedinPost: c.linkedinPost,
        twitterThread: c.shortsScript,
        emailNewsletter: c.simpleExplanation,
        status: "DRAFT",
      },
    });
    return NextResponse.json({ campaign });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, type, ...data } = body;

  if (type === "campaign") {
    const campaign = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        name: data.name,
        platforms: data.platforms ? JSON.stringify(data.platforms) : undefined,
        hashtags: data.hashtags ? JSON.stringify(data.hashtags) : undefined,
        linkedinPost: data.linkedinPost,
        twitterThread: data.twitterThread,
        emailNewsletter: data.emailNewsletter,
        status: data.status,
        launchDate: data.launchDate ? new Date(data.launchDate) : undefined,
        notes: data.notes,
      },
    });
    return NextResponse.json({ campaign });
  }

  if (type === "analytics") {
    const entry = await prisma.analyticsEntry.update({
      where: { id },
      data: {
        views: data.views,
        ctr: data.ctr,
        likes: data.likes,
        notes: data.notes,
      },
    });
    return NextResponse.json({ entry });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
