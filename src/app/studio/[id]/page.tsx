import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Teleprompter } from "@/components/teleprompter";
import { PresentationMode } from "@/components/presentation-mode";
import { ProductionHub } from "@/components/production-hub";
import { ResearchExportButton } from "@/components/research-export-button";
import type { PresentationSlide } from "@/lib/content";
import { parseScreenshots } from "@/lib/production/uploads";
import type { ProductionStep } from "@prisma/client";
import { ArrowLeft } from "lucide-react";

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
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Full project details
          </Link>

          <header className="mb-8">
            <p className="text-accent text-sm font-medium mb-1">Content Production Pipeline</p>
            <h1 className="text-3xl font-bold mb-2">
              {project.content?.youtubeTitle ?? project.name ?? "Production Hub"}
            </h1>
            <p className="text-muted mb-4">{project.content?.hook ?? project.description}</p>
            <ResearchExportButton projectId={id} projectName={project.name} variant="primary" />
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
