/** Premium tool bridge utilities — feeds paid tools, does not replace them */

export const PREMIUM_LINKS = {
  chatgpt: "https://chatgpt.com/",
  notebooklm: "https://notebooklm.google.com/",
  riverside: "https://riverside.fm/dashboard/studio/default",
  canva: "https://www.canva.com/video-editor/",
  youtubeStudio: "https://studio.youtube.com/",
} as const;

export interface ConnectorContext {
  projectName: string;
  projectUrl: string;
  hook?: string | null;
  script?: string | null;
  refinedScript?: string | null;
  recordingOutline?: string | null;
  notebookLmBrief?: string | null;
  slidesMarkdown?: string;
  youtubeTitle?: string | null;
  description?: string | null;
  hashtags?: string[];
  thumbnailPrompt?: string | null;
  canvaNotes?: string | null;
  score?: number | null;
  recommendation?: string | null;
}

export function buildChatGPTPrompt(ctx: ConnectorContext): string {
  return `# CurioStudio → ChatGPT

I'm producing a YouTube video for the Everyday Series. Help me refine this content.

## Project
- **Name:** ${ctx.projectName}
- **URL:** ${ctx.projectUrl}
${ctx.score != null ? `- **Score:** ${ctx.score}/100` : ""}
${ctx.recommendation ? `- **Verdict:** ${ctx.recommendation}` : ""}

## Hook
${ctx.hook ?? "(generate a stronger hook)"}

## Current Script
${ctx.refinedScript ?? ctx.script ?? "(no script yet — generate from repo context)"}

## Task
Review and improve this script for YouTube retention. Keep sandbox safety messaging. Suggest 3 hook alternatives.

---
Paste this into ChatGPT or use OpenAI API directly from CurioStudio Settings.`;
}

export function buildNotebookLMBrief(ctx: ConnectorContext): string {
  if (ctx.notebookLmBrief) return ctx.notebookLmBrief;

  return `# ${ctx.projectName} — NotebookLM Research Brief

## Overview
${ctx.projectUrl}

## Hook
${ctx.hook ?? ""}

## Script Summary
${(ctx.refinedScript ?? ctx.script ?? "").slice(0, 3000)}

## Talking Points
- Tested safely in isolated sandbox, not on personal laptop
- ${ctx.recommendation ?? "See scorecard for verdict"}

## Slides
${ctx.slidesMarkdown ?? "(generate slides in Production Hub first)"}

## Upload Instructions
1. Go to notebooklm.google.com
2. Create new notebook
3. Upload this file as a source
4. Ask NotebookLM to generate audio overview or study guide`;
}

export function buildRiversideTeleprompter(ctx: ConnectorContext): string {
  const script = ctx.refinedScript ?? ctx.script ?? "";
  const outline = ctx.recordingOutline ?? "";

  return `RIVERSIDE.FM TELEPROMPTER EXPORT
Project: ${ctx.projectName}
URL: ${ctx.projectUrl}

=== RECORDING CHECKLIST ===
[ ] Microphone tested in Riverside
[ ] Camera + lighting ready
[ ] Slides rehearsed once
[ ] Teleprompter speed calibrated (start at 40 WPM)
[ ] Screen share / demo tab prepared
[ ] Water nearby

=== TELEPROMPTER SCRIPT ===

${outline || script}

=== END ===

Open Riverside: ${PREMIUM_LINKS.riverside}`;
}

export function buildCanvaExportNotes(ctx: ConnectorContext): string {
  return `# Canva Post-Production — ${ctx.projectName}

## Video Notes
- Import raw recording from Riverside.fm
- Project URL for B-roll: ${ctx.projectUrl}
- Score: ${ctx.score ?? "—"}/100

## Thumbnail
${ctx.thumbnailPrompt ?? "Generate thumbnail prompt in Edit step"}

## Slides for B-roll
${ctx.slidesMarkdown ?? ""}

## Workflow
${ctx.canvaNotes ?? ""}

Open Canva: ${PREMIUM_LINKS.canva}`;
}

export function buildYouTubeMetadataBundle(ctx: ConnectorContext): string {
  const tags = ctx.hashtags ?? [];
  return `=== YOUTUBE UPLOAD BUNDLE ===

TITLE:
${ctx.youtubeTitle ?? ctx.projectName}

DESCRIPTION:
${ctx.description ?? ""}

TAGS:
${tags.join(", ")}

HASHTAGS:
${tags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}

THUMBNAIL PROMPT:
${ctx.thumbnailPrompt ?? ""}

REPO LINK:
${ctx.projectUrl}

YouTube Studio: ${PREMIUM_LINKS.youtubeStudio}
=== END BUNDLE ===`;
}

export function getYouTubeStudioUploadUrl(): string {
  return "https://studio.youtube.com/channel/upload";
}
