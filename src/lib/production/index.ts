import { prisma } from "@/lib/db";
import {
  generateJSON,
  generateTextWithVision,
  generateThumbnailImage,
  SCRIPT_SYSTEM_PROMPT,
  SLIDES_SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
  THUMBNAIL_SYSTEM_PROMPT,
  METADATA_SYSTEM_PROMPT,
  VISION_PROMPT,
} from "@/lib/llm";
import type { PresentationSlide } from "@/lib/content";
import { CANVA_WORKFLOW } from "./constants";
export { PIPELINE_STEPS, RECORDING_CHECKLIST, CANVA_WORKFLOW } from "./constants";
export { slidesToMarkdown } from "./slides";
import { getScreenshotAbsolutePath, parseScreenshots } from "./uploads";
import { readFile } from "fs/promises";

interface SlideResponse {
  slides?: { title: string; body: string; speakerNotes: string; durationSec?: number }[];
}

interface ScriptResponse {
  script5min?: string;
  script10min?: string;
  recordingOutline?: string;
  refinedScript?: string;
}

interface MetadataResponse {
  youtubeTitle?: string;
  description?: string;
  hashtags?: string[];
  thumbnailIdea?: string;
  thumbnailPrompt?: string;
}

async function loadProjectContext(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { scan: true, sandbox: true, scorecard: true, content: true },
  });
  if (!project) throw new Error("Project not found");
  return project;
}

function buildBaseContext(project: Awaited<ReturnType<typeof loadProjectContext>>): string {
  const pros = project.scorecard?.pros ? JSON.parse(project.scorecard.pros) : [];
  const cons = project.scorecard?.cons ? JSON.parse(project.scorecard.cons) : [];
  const stack = project.scan?.detectedStack ? JSON.parse(project.scan.detectedStack) : [];

  return JSON.stringify({
    name: project.name,
    url: project.url,
    description: project.description,
    readme_excerpt: project.readme?.slice(0, 3000),
    scorecard: {
      whatItDoes: project.scorecard?.whatItDoes,
      problemSolved: project.scorecard?.problemSolved,
      overallScore: project.scorecard?.overallScore,
      recommendation: project.scorecard?.recommendation,
      pros,
      cons,
    },
    stack,
    risk: project.scan ? { level: project.scan.riskLevel, score: project.scan.riskScore } : null,
    sandbox: project.sandbox
      ? { status: project.sandbox.status, install: project.sandbox.installCommand }
      : null,
    existingScript: project.content?.script5min?.slice(0, 2000),
  });
}

async function loadScreenshotDescriptions(projectId: string, screenshotsJson: string | null): Promise<string> {
  const screenshots = parseScreenshots(screenshotsJson);
  if (!screenshots.length) return "";

  const descriptions: string[] = [];
  for (const shot of screenshots.slice(0, 5)) {
    try {
      const absPath = getScreenshotAbsolutePath(shot.path);
      const buffer = await readFile(absPath);
      const base64 = buffer.toString("base64");
      const ext = shot.filename.toLowerCase();
      const mime = ext.endsWith(".png") ? "image/png" : ext.endsWith(".webp") ? "image/webp" : "image/jpeg";
      const desc = await generateTextWithVision(
        VISION_PROMPT,
        base64,
        mime
      );
      descriptions.push(`Screenshot "${shot.filename}": ${desc ?? "User-provided project screenshot"}`);
    } catch {
      descriptions.push(`Screenshot "${shot.filename}": user-provided context image`);
    }
  }
  return descriptions.join("\n");
}

export async function regenerateInitialScript(projectId: string): Promise<void> {
  const project = await loadProjectContext(projectId);
  const screenshotContext = await loadScreenshotDescriptions(projectId, project.screenshots);
  const base = buildBaseContext(project);

  const result = await generateJSON<ScriptResponse & MetadataResponse>(
    [
      {
        role: "system",
        content: SCRIPT_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `${base}\n\nScreenshot context:\n${screenshotContext || "No screenshots uploaded"}`,
      },
    ],
    "script"
  );

  await prisma.content.upsert({
    where: { projectId },
    create: {
      projectId,
      script5min: result?.script5min ?? "",
      script10min: result?.script10min ?? "",
      recordingOutline: result?.recordingOutline ?? "",
      youtubeTitle: result?.youtubeTitle ?? `${project.name} — Safe Review`,
      description: result?.description ?? "",
      hashtags: JSON.stringify(result?.hashtags ?? []),
      thumbnailIdea: result?.thumbnailIdea ?? "",
      hook: `Today we're testing ${project.name} safely in a sandbox.`,
    },
    update: {
      script5min: result?.script5min ?? project.content?.script5min,
      script10min: result?.script10min ?? project.content?.script10min,
      recordingOutline: result?.recordingOutline ?? project.content?.recordingOutline,
      youtubeTitle: result?.youtubeTitle ?? project.content?.youtubeTitle,
      description: result?.description ?? project.content?.description,
      hashtags: JSON.stringify(
        result?.hashtags ?? (project.content?.hashtags ? JSON.parse(project.content.hashtags) : [])
      ),
      thumbnailIdea: result?.thumbnailIdea ?? project.content?.thumbnailIdea,
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "SCRIPT_READY", workflowStep: "SCRIPT" },
  });
}

export async function generateSlides(projectId: string): Promise<PresentationSlide[]> {
  const project = await loadProjectContext(projectId);
  const script = project.content?.script5min ?? project.content?.refinedScript ?? "";
  const base = buildBaseContext(project);

  const result = await generateJSON<SlideResponse>(
    [
      {
        role: "system",
        content: SLIDES_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `${base}\n\nScript to align with:\n${script.slice(0, 4000)}`,
      },
    ],
    "slides"
  );

  let slides: PresentationSlide[] = (result?.slides ?? []).map((s, i) => ({
    id: `slide-${i + 1}`,
    title: s.title,
    body: s.body,
    speakerNotes: s.speakerNotes,
    durationSec: s.durationSec ?? 45,
  }));

  if (!slides.length && project.content?.presentationSlides) {
    slides = JSON.parse(project.content.presentationSlides);
  }

  if (!slides.length) {
    slides = [
      {
        id: "slide-1",
        title: project.name ?? "Project",
        body: project.content?.hook ?? project.description ?? "",
        speakerNotes: "Open with energy.",
        durationSec: 15,
      },
    ];
  }

  await prisma.content.upsert({
    where: { projectId },
    create: {
      projectId,
      presentationSlides: JSON.stringify(slides),
      script5min: script,
    },
    update: { presentationSlides: JSON.stringify(slides) },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { workflowStep: "SLIDES" },
  });

  return slides;
}

export async function refineScriptFromSlides(projectId: string): Promise<string> {
  const project = await loadProjectContext(projectId);
  const slides: PresentationSlide[] = project.content?.presentationSlides
    ? JSON.parse(project.content.presentationSlides)
    : [];

  const result = await generateJSON<ScriptResponse>(
    [
      {
        role: "system",
        content: REFINE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify({
          project: project.name,
          slides: slides.map((s) => ({
            title: s.title,
            body: s.body,
            notes: s.speakerNotes,
            durationSec: s.durationSec,
          })),
          originalScript: project.content?.script5min?.slice(0, 3000),
        }),
      },
    ],
    "refine"
  );

  const refined = result?.refinedScript ?? result?.script5min ?? project.content?.script5min ?? "";

  await prisma.content.update({
    where: { projectId },
    data: {
      refinedScript: refined,
      recordingOutline: result?.recordingOutline ?? project.content?.recordingOutline,
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { workflowStep: "REFINE" },
  });

  return refined;
}

export async function generateThumbnailPrompt(projectId: string): Promise<{
  prompt: string;
  idea: string;
  svgPreview: string;
  imageUrl?: string;
}> {
  const project = await loadProjectContext(projectId);
  const screenshotContext = await loadScreenshotDescriptions(projectId, project.screenshots);

  const result = await generateJSON<{ thumbnailPrompt?: string; thumbnailIdea?: string }>(
    [
      {
        role: "system",
        content: THUMBNAIL_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `${buildBaseContext(project)}\nScreenshots: ${screenshotContext}\nTitle: ${project.content?.youtubeTitle}`,
      },
    ],
    "thumbnail"
  );

  const prompt =
    result?.thumbnailPrompt ??
    project.content?.thumbnailPrompt ??
    `YouTube thumbnail, 1280x720, bold text "${project.name}", dark navy background, green "SANDBOX TESTED" badge, developer aesthetic`;
  const idea = result?.thumbnailIdea ?? project.content?.thumbnailIdea ?? prompt.slice(0, 120);

  const svgPreview = buildThumbnailSvgPreview(project.name ?? "Project", idea);
  const imageUrl = await generateThumbnailImage(prompt);

  await prisma.content.update({
    where: { projectId },
    data: { thumbnailPrompt: prompt, thumbnailIdea: idea, canvaExportNotes: CANVA_WORKFLOW },
  });

  return { prompt, idea, svgPreview, imageUrl: imageUrl ?? undefined };
}

function buildThumbnailSvgPreview(name: string, tagline: string): string {
  const safeName = name.slice(0, 40).replace(/[<>&"']/g, "");
  const safeTag = tagline.slice(0, 60).replace(/[<>&"']/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="40" y="40" width="200" height="48" rx="8" fill="#10b981"/>
  <text x="140" y="72" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="18" font-weight="bold">SANDBOX TESTED</text>
  <text x="640" y="320" text-anchor="middle" fill="white" font-family="system-ui,sans-serif" font-size="64" font-weight="bold">${safeName}</text>
  <text x="640" y="400" text-anchor="middle" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="28">${safeTag}</text>
  <rect x="440" y="480" width="400" height="4" fill="#10b981"/>
</svg>`;
}

export async function regenerateMetadata(projectId: string): Promise<void> {
  const project = await loadProjectContext(projectId);
  const script = project.content?.refinedScript ?? project.content?.script5min ?? "";

  const result = await generateJSON<MetadataResponse>(
    [
      {
        role: "system",
        content: METADATA_SYSTEM_PROMPT,
      },
      { role: "user", content: `${buildBaseContext(project)}\n\nScript excerpt:\n${script.slice(0, 2000)}` },
    ],
    "metadata"
  );

  const tags = result?.hashtags ?? [];

  await prisma.content.update({
    where: { projectId },
    data: {
      youtubeTitle: result?.youtubeTitle ?? project.content?.youtubeTitle,
      description: result?.description ?? project.content?.description,
      hashtags: JSON.stringify(tags),
    },
  });

  await prisma.youTubeMetadata.upsert({
    where: { projectId },
    create: {
      projectId,
      title: result?.youtubeTitle ?? project.content?.youtubeTitle,
      description: result?.description ?? project.content?.description,
      tags: JSON.stringify(tags),
    },
    update: {
      title: result?.youtubeTitle ?? project.content?.youtubeTitle,
      description: result?.description ?? project.content?.description,
      tags: JSON.stringify(tags),
    },
  });
}

export async function saveSlides(projectId: string, slides: PresentationSlide[]): Promise<void> {
  await prisma.content.update({
    where: { projectId },
    data: { presentationSlides: JSON.stringify(slides) },
  });
}

export async function saveScript(projectId: string, script: string, type: "5min" | "10min" | "refined"): Promise<void> {
  const data =
    type === "refined"
      ? { refinedScript: script }
      : type === "10min"
        ? { script10min: script, selectedScriptType: "10min" }
        : { script5min: script, selectedScriptType: "5min" };

  await prisma.content.update({ where: { projectId }, data });
}

export function buildYouTubeCopyBundle(project: {
  name: string | null;
  url: string;
  content: {
    youtubeTitle: string | null;
    description: string | null;
    hashtags: string | null;
    thumbnailPrompt: string | null;
    thumbnailIdea: string | null;
  } | null;
  youtubeMetadata: {
    title: string | null;
    description: string | null;
    tags: string | null;
    category: string | null;
    scheduledAt: Date | null;
    privacyStatus: string | null;
  } | null;
  scheduledPublishAt: Date | null;
}): string {
  const c = project.content;
  const yt = project.youtubeMetadata;
  const tags: string[] = yt?.tags ? JSON.parse(yt.tags) : c?.hashtags ? JSON.parse(c.hashtags) : [];
  const schedule = yt?.scheduledAt ?? project.scheduledPublishAt;

  return `=== YOUTUBE UPLOAD BUNDLE ===

TITLE:
${yt?.title ?? c?.youtubeTitle ?? project.name}

DESCRIPTION:
${yt?.description ?? c?.description ?? ""}

TAGS (paste in YouTube tags field):
${tags.join(", ")}

HASHTAGS (append to description):
${tags.map((t) => `#${t}`).join(" ")}

CATEGORY: ${yt?.category ?? "28"} (Science & Technology)
PRIVACY: ${yt?.privacyStatus ?? "private"}
SCHEDULED: ${schedule ? new Date(schedule).toLocaleString() : "Publish immediately"}

THUMBNAIL PROMPT:
${c?.thumbnailPrompt ?? c?.thumbnailIdea ?? ""}

REPO LINK:
${project.url}

=== END BUNDLE ===`;
}
