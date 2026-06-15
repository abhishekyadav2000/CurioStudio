import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Teleprompter } from "@/components/teleprompter";
import { PresentationMode } from "@/components/presentation-mode";
import { ProductionHub } from "@/components/production-hub";
import type { PresentationSlide } from "@/lib/content";
import { parseScreenshots } from "@/lib/production/uploads";
import type { ProductionStep } from "@prisma/client";
import { ArrowLeft, Mic, Presentation } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; step?: string }>;
}) {
  const { id } = await params;
  const { mode, step: stepParam } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { content: true, scorecard: true, scan: true, youtubeMetadata: true },
  });

  if (!project) notFound();

  const slides: PresentationSlide[] = project.content?.presentationSlides
    ? JSON.parse(project.content.presentationSlides)
    : [];

  const script =
    project.content?.refinedScript ??
    project.content?.script5min ??
    project.content?.recordingOutline ??
    "";

  if (mode === "teleprompter") {
    return (
      <div className="min-h-screen bg-black">
        <Teleprompter
          projectId={id}
          script={script}
          title={project.content?.youtubeTitle ?? project.name ?? "Script"}
          outline={project.content?.recordingOutline ?? undefined}
        />
      </div>
    );
  }

  if (mode === "present" && slides.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <PresentationMode slides={slides} projectName={project.name ?? "Project"} />
      </div>
    );
  }

  const hashtags: string[] = project.content?.hashtags ? JSON.parse(project.content.hashtags) : [];
  const ytTags: string[] = project.youtubeMetadata?.tags ? JSON.parse(project.youtubeMetadata.tags) : [];
  const checklist: Record<string, boolean> = project.recordingChecklist
    ? JSON.parse(project.recordingChecklist)
    : {};

  const initialStep = (stepParam?.toUpperCase() as ProductionStep) || undefined;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 lg:p-8">
          <Link
            href={`/projects/${id}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Project details & Research PDF
          </Link>

          <header className="mb-6">
            <h1 className="text-2xl font-bold mb-1">
              {project.content?.youtubeTitle ?? project.name ?? "Studio"}
            </h1>
            <p className="text-sm text-muted mb-4 line-clamp-2">{project.content?.hook ?? project.description}</p>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/studio/${id}?mode=teleprompter`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm hover:bg-accent-dim"
              >
                <Mic className="w-4 h-4" />
                Teleprompter
              </Link>
              {slides.length > 0 ? (
                <Link
                  href={`/studio/${id}?mode=present`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:border-accent/30 text-sm"
                >
                  <Presentation className="w-4 h-4" />
                  Presentation
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted">
                  <Presentation className="w-4 h-4" />
                  Generate slides first
                </span>
              )}
            </div>
          </header>

          <ProductionHub
            projectId={id}
            projectName={project.name ?? "Project"}
            projectUrl={project.url}
            status={project.status}
            workflowStep={project.workflowStep}
            screenshots={parseScreenshots(project.screenshots)}
            recordingChecklist={checklist}
            initialStep={initialStep}
            score={project.scorecard?.overallScore ?? null}
            scheduledPublishAt={project.scheduledPublishAt?.toISOString() ?? null}
            content={
              project.content
                ? {
                    youtubeTitle: project.content.youtubeTitle,
                    hook: project.content.hook,
                    script5min: project.content.script5min,
                    script10min: project.content.script10min,
                    refinedScript: project.content.refinedScript,
                    recordingOutline: project.content.recordingOutline,
                    description: project.content.description,
                    hashtags,
                    thumbnailIdea: project.content.thumbnailIdea,
                    thumbnailPrompt: project.content.thumbnailPrompt,
                    canvaExportNotes: project.content.canvaExportNotes,
                    presentationSlides: slides,
                  }
                : null
            }
            youtubeMetadata={
              project.youtubeMetadata
                ? {
                    title: project.youtubeMetadata.title,
                    description: project.youtubeMetadata.description,
                    tags: ytTags,
                    category: project.youtubeMetadata.category,
                    scheduledAt: project.youtubeMetadata.scheduledAt?.toISOString() ?? null,
                    privacyStatus: project.youtubeMetadata.privacyStatus,
                  }
                : null
            }
          />
        </div>
    </AppShell>
  );
}
