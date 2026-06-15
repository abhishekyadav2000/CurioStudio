import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildYouTubeCopyBundle, CANVA_WORKFLOW, slidesToMarkdown } from "@/lib/production";
import type { PresentationSlide } from "@/lib/content";
import {
  getResearchDocumentMarkdown,
  researchExportFilename,
  RESEARCH_PROJECT_INCLUDE,
} from "@/lib/research-document";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: RESEARCH_PROJECT_INCLUDE,
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const format = _request.nextUrl.searchParams.get("format");

  if (format === "research") {
    const result = await getResearchDocumentMarkdown(id);
    if (!result) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return new NextResponse(result.markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${researchExportFilename(result.project, "md")}"`,
      },
    });
  }

  if (!project.content) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  const slides: PresentationSlide[] = project.content.presentationSlides
    ? JSON.parse(project.content.presentationSlides)
    : [];

  const bundle = {
    project: {
      name: project.name,
      url: project.url,
      owner: project.owner,
      stars: project.stars,
      description: project.description,
    },
    scorecard: project.scorecard,
    content: {
      youtubeTitle: project.content.youtubeTitle,
      hook: project.content.hook,
      script5min: project.content.script5min,
      script10min: project.content.script10min,
      refinedScript: project.content.refinedScript,
      recordingOutline: project.content.recordingOutline,
      notebookLmBrief: project.content.notebookLmBrief,
      description: project.content.description,
      hashtags: project.content.hashtags ? JSON.parse(project.content.hashtags) : [],
      thumbnailPrompt: project.content.thumbnailPrompt,
      slides,
    },
    youtube: project.youtubeMetadata,
    exportedAt: new Date().toISOString(),
  };

  if (format === "notebooklm") {
    return new NextResponse(project.content.notebookLmBrief ?? "", {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${project.name}-notebooklm-brief.md"`,
      },
    });
  }

  if (format === "script") {
    const script =
      project.content.refinedScript ??
      project.content.script5min ??
      project.content.recordingOutline ??
      "";
    return new NextResponse(script, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${project.name}-script.txt"`,
      },
    });
  }

  if (format === "slides") {
    const md = slidesToMarkdown(slides);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${project.name}-slides.md"`,
      },
    });
  }

  if (format === "youtube") {
    const copy = buildYouTubeCopyBundle(project);
    return new NextResponse(copy, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${project.name}-youtube-bundle.txt"`,
      },
    });
  }

  if (format === "markdown") {
    const research = await getResearchDocumentMarkdown(id);
    const md = buildMarkdownBundle(project, slides, research?.markdown);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${project.name}-production-pack.md"`,
      },
    });
  }

  return NextResponse.json(bundle);
}

function buildMarkdownBundle(
  project: {
    name: string | null;
    url: string;
    content: {
      youtubeTitle: string | null;
      hook: string | null;
      script5min: string | null;
      script10min: string | null;
      refinedScript: string | null;
      recordingOutline: string | null;
      notebookLmBrief: string | null;
      description: string | null;
      hashtags: string | null;
      thumbnailPrompt: string | null;
      thumbnailIdea: string | null;
      canvaExportNotes: string | null;
    } | null;
    scorecard: { overallScore: number | null; recommendation: string | null } | null;
  },
  slides: PresentationSlide[],
  researchDocument?: string
): string {
  const c = project.content!;
  const youtubeBundle = buildYouTubeCopyBundle({
    name: project.name,
    url: project.url,
    content: {
      youtubeTitle: c.youtubeTitle,
      description: c.description,
      hashtags: c.hashtags,
      thumbnailPrompt: c.thumbnailPrompt,
      thumbnailIdea: c.thumbnailIdea,
    },
    youtubeMetadata: null,
    scheduledPublishAt: null,
  });

  return `# Production Pack: ${project.name}

> ${c.hook}

**URL:** ${project.url}
**Score:** ${project.scorecard?.overallScore ?? "—"}/100
**Recommendation:** ${project.scorecard?.recommendation ?? ""}

---

## YouTube Upload Bundle
${youtubeBundle}

## Refined Script (Teleprompter)
${c.refinedScript ?? c.script5min}

## Recording Outline
${c.recordingOutline}

## 5-Minute Script
${c.script5min}

## 10-Minute Script
${c.script10min}

## Presentation Slides
${slidesToMarkdown(slides)}

## Thumbnail Prompt
${c.thumbnailPrompt ?? c.thumbnailIdea ?? ""}

## Canva Post-Production Guide
${c.canvaExportNotes ?? CANVA_WORKFLOW}

---

## Research Document (NotebookLM)
${researchDocument ?? c.notebookLmBrief ?? ""}

---

## NotebookLM Brief (legacy export)
${c.notebookLmBrief}
`;
}
