import { prisma } from "@/lib/db";
import { sourceLabel } from "@/lib/importer/detect-source";
import { formatDate, formatRelative } from "@/lib/utils";
import { parseScreenshots } from "@/lib/production/uploads";
import type { Prisma } from "@prisma/client";

export { RESEARCH_DOCUMENT_SECTIONS, RESEARCH_EXPORT_TOOLTIP } from "./constants";

export type ResearchProject = Prisma.ProjectGetPayload<{
  include: {
    scan: true;
    sandbox: true;
    scorecard: true;
    content: true;
    notes: true;
    youtubeMetadata: true;
  };
}>;

export const RESEARCH_PROJECT_INCLUDE = {
  scan: true,
  sandbox: true,
  scorecard: true,
  content: true,
  notes: { orderBy: { createdAt: "desc" as const } },
  youtubeMetadata: true,
} satisfies Prisma.ProjectInclude;

export function slugifyProjectName(name: string | null | undefined): string {
  return (
    (name ?? "project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "project"
  );
}

function parseJsonArray<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function readmeExcerpt(readme: string | null | undefined): string {
  if (!readme) return "_No README captured during import._";
  const cleaned = readme.replace(/^#+\s+/gm, "").trim();
  const lines = cleaned.split("\n").filter((l) => l.trim());
  const intro = lines.slice(0, 12).join("\n");
  return truncate(intro, 2500);
}

function dependencyExcerpts(dependencyFiles: string[]): string {
  if (!dependencyFiles.length) return "_No dependency manifests detected._";
  return dependencyFiles
    .slice(0, 12)
    .map((f) => `- \`${f}\``)
    .join("\n");
}

function formatVulnerabilities(vulns: unknown[]): string {
  if (!vulns.length) return "No known vulnerabilities flagged in pre-run scan.";
  return vulns
    .slice(0, 8)
    .map((v) => {
      if (typeof v === "string") return `- ${v}`;
      if (v && typeof v === "object" && "id" in v) return `- ${String((v as { id: string }).id)}`;
      return `- ${JSON.stringify(v).slice(0, 120)}`;
    })
    .join("\n");
}

function sandboxLogSummary(logs: string | null | undefined, errors: string | null | undefined): string {
  const parts: string[] = [];
  if (logs) parts.push(`**Logs (excerpt):**\n\`\`\`\n${truncate(logs, 1500)}\n\`\`\``);
  if (errors) parts.push(`**Errors:**\n\`\`\`\n${truncate(errors, 800)}\n\`\`\``);
  return parts.length ? parts.join("\n\n") : "_No sandbox logs captured._";
}

export function buildResearchDocumentMarkdown(project: ResearchProject): string {
  const meta = project.metadata ? (JSON.parse(project.metadata) as Record<string, unknown>) : {};
  const topics = Array.isArray(meta.topics) ? (meta.topics as string[]) : [];
  const cloneUrl = typeof meta.cloneUrl === "string" ? meta.cloneUrl : project.url;
  const techStack = parseJsonArray<string>(project.techStack);
  const pros = parseJsonArray<string>(project.scorecard?.pros);
  const cons = parseJsonArray<string>(project.scorecard?.cons);
  const setupSteps = parseJsonArray<string>(project.scorecard?.setupSteps);
  const suspicious = parseJsonArray<string>(project.scan?.suspiciousFiles);
  const vulnerabilities = parseJsonArray<unknown>(project.scan?.vulnerabilities);
  const dependencyFiles = parseJsonArray<string>(project.scan?.dependencyFiles);
  const detectedStack = parseJsonArray<string>(project.scan?.detectedStack);
  const installScripts = parseJsonArray<string>(project.scan?.installScripts);
  const networkCalls = parseJsonArray<string>(project.scan?.networkCalls);
  const hashtags = parseJsonArray<string>(project.content?.hashtags);
  const smokeTest = project.sandbox?.smokeTest ? JSON.parse(project.sandbox.smokeTest) : null;
  const screenshots = parseScreenshots(project.screenshots);
  const score = project.scorecard;
  const content = project.content;
  const scan = project.scan;
  const sandbox = project.sandbox;

  const executive =
    score?.whatItDoes ??
    project.description ??
    content?.simpleExplanation ??
    `${project.name ?? "This project"} was discovered via ${sourceLabel(project.source)} and queued for review in CurioStudio.`;

  const shouldCover =
    score?.recommendation ??
    (score?.overallScore != null && score.overallScore >= 50
      ? "Worth covering with caveats — see scorecard."
      : "Review scorecard and risk before committing to a video.");

  const videoAngles = [
    content?.hook ? `**Opening hook:** ${content.hook}` : null,
    content?.youtubeTitle ? `**Suggested title:** ${content.youtubeTitle}` : null,
    score?.videoWorthiness != null ? `**Video worthiness:** ${score.videoWorthiness}/100` : null,
    content?.shortsScript ? `**Shorts angle:** ${truncate(content.shortsScript, 400)}` : null,
    content?.recordingOutline ? `**Recording beats:**\n${truncate(content.recordingOutline, 1200)}` : null,
    `**Everyday Series fit:** Daily open-source review — emphasize safe sandbox testing, honest pros/cons, and a clear verdict for developers and curious non-devs.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const sources = [
    `- **Primary repo:** ${project.url}`,
    cloneUrl !== project.url ? `- **Clone URL:** ${cloneUrl}` : null,
    project.youtubeMetadata?.title ? `- **YouTube draft title:** ${project.youtubeMetadata.title}` : null,
    ...screenshots.map((s) => `- **Screenshot:** ${s.path} (${s.filename})`),
  ]
    .filter(Boolean)
    .join("\n");

  const screenshotSection =
    screenshots.length === 0
      ? "_No screenshots uploaded yet. Add them in Production Studio → Import step._"
      : screenshots.map((s) => `![${s.filename}](${s.path})\n_${s.filename} · uploaded ${formatDate(s.uploadedAt)}_`).join("\n\n");

  const notesSection =
    project.notes.length === 0
      ? "_No editor notes._"
      : project.notes.map((n) => `- ${formatDate(n.createdAt)}: ${n.content}`).join("\n");

  return `# ${project.name ?? "Project"} — CurioStudio Research Document

> Comprehensive research brief for NotebookLM and production planning.  
> Generated ${new Date().toISOString()} · CurioStudio Everyday Series pipeline

---

## 1. Executive Summary

${executive}

${content?.hook ? `\n**Suggested hook:** ${content.hook}` : ""}

**Overall verdict:** ${score?.overallScore ?? "—"}/100 — ${shouldCover}

---

## 2. Source Metadata

| Field | Value |
|-------|-------|
| Name | ${project.name ?? "—"} |
| Owner | ${project.owner ? `@${project.owner}` : "—"} |
| Source | ${sourceLabel(project.source)} |
| URL | ${project.url} |
| Stars | ${project.stars?.toLocaleString() ?? "—"} |
| Language | ${project.language ?? "—"} |
| License | ${project.license ?? scan?.licenseInfo ?? "—"} |
| Last commit | ${project.lastCommit ? `${formatDate(project.lastCommit)} (${formatRelative(project.lastCommit)})` : scan?.lastCommitDays != null ? `${scan.lastCommitDays} days ago` : "—"} |
| Open issues | ${scan?.openIssues ?? "—"} |
| Topics | ${topics.length ? topics.join(", ") : "—"} |
| Pipeline status | ${project.status} |
| Workflow step | ${project.workflowStep} |

---

## 3. README Summary & Excerpts

${readmeExcerpt(project.readme)}

---

## 4. Technical Analysis

**Detected stack:** ${detectedStack.length ? detectedStack.join(", ") : techStack.length ? techStack.join(", ") : "Unknown"}

**Tech stack (import):** ${techStack.length ? techStack.join(", ") : "—"}

**Simple explanation:** ${content?.simpleExplanation ?? score?.whatItDoes ?? "—"}

**Technical explanation:** ${content?.technicalExplanation ?? "—"}

**Problem solved:** ${score?.problemSolved ?? "—"}

**Dependency manifests found:**
${dependencyExcerpts(dependencyFiles)}

**Install scripts flagged:** ${installScripts.length ? installScripts.join(", ") : "None detected"}

**Network patterns:** ${networkCalls.length ? networkCalls.slice(0, 6).join(", ") : "None flagged"}

---

## 5. Security & Sandbox Scan

| Metric | Value |
|--------|-------|
| Risk score | ${scan?.riskScore ?? "—"}/100 |
| Risk level | ${scan?.riskLevel ?? "unknown"} |
| License (scan) | ${scan?.licenseInfo ?? "—"} |
| Suspicious files | ${suspicious.length ? suspicious.join(", ") : "None"} |

**Vulnerabilities:**
${formatVulnerabilities(vulnerabilities)}

${scan?.scanLog ? `\n**Scan log (excerpt):**\n\`\`\`\n${truncate(scan.scanLog, 1200)}\n\`\`\`` : ""}

---

## 6. Test Run Verdict

| Field | Value |
|-------|-------|
| Provider | ${sandbox?.provider ?? "—"} |
| Status | ${sandbox?.status ?? "Not run"} |
| Verdict | ${sandbox?.verdict ?? "—"} |
| Install command | \`${sandbox?.installCommand ?? "—"}\` |
| Run command | \`${sandbox?.runCommand ?? "—"}\` |
| Exit code | ${sandbox?.exitCode ?? "—"} |
| Duration | ${sandbox?.durationMs != null ? `${(sandbox.durationMs / 1000).toFixed(1)}s` : "—"} |
| Network policy | ${sandbox?.networkPolicy ?? "—"} |

**What worked:** ${score?.whatWorked ?? "—"}

**What failed:** ${score?.whatFailed ?? "—"}

${smokeTest ? `**Smoke test:** \`${smokeTest.command ?? ""}\` → exit ${smokeTest.exitCode ?? "—"}\n\`\`\`\n${truncate(String(smokeTest.output ?? ""), 800)}\n\`\`\`` : ""}

${sandboxLogSummary(sandbox?.logs ?? null, sandbox?.errors ?? null)}

---

## 7. Content Analysis & Hook Ideas

**YouTube title:** ${content?.youtubeTitle ?? "—"}

**Description:** ${truncate(content?.description, 1500) || "—"}

**Hashtags:** ${hashtags.length ? hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ") : "—"}

**LinkedIn post draft:**
${truncate(content?.linkedinPost, 800) || "—"}

**NotebookLM brief (legacy):**
${content?.notebookLmBrief ?? "—"}

---

## 8. Risks, Limitations & Should We Cover This?

**Install difficulty:** ${score?.installDifficulty ?? "—"}/10  
**Usefulness:** ${score?.usefulnessScore ?? "—"}/10  
**Video worthiness:** ${score?.videoWorthiness ?? "—"}/10  
**Overall score:** ${score?.overallScore ?? "—"}/100

**Pros:**
${pros.length ? pros.map((p) => `- ${p}`).join("\n") : "- None recorded"}

**Cons:**
${cons.length ? cons.map((c) => `- ${c}`).join("\n") : "- None recorded"}

**Recommendation:** ${shouldCover}

**Setup steps:**
${setupSteps.length ? setupSteps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "See README excerpts above."}

---

## 9. Video Angles & Everyday Series Fit

${videoAngles}

**5-minute script preview:**
${truncate(content?.script5min, 2000) || "Generate content in pipeline to populate."}

---

## 10. Sources & URLs

${sources}

---

## 11. Screenshots

${screenshotSection}

---

## 12. Raw Dependency Excerpts

Files identified during scan (contents not stored — re-fetch from repo if needed):

${dependencyExcerpts(dependencyFiles)}

---

## 13. Editor Notes

${notesSection}

---

_End of research document — upload to NotebookLM as a single source for audio overview, study guide, and Q&A._
`;
}

export async function fetchResearchProject(projectId: string): Promise<ResearchProject | null> {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: RESEARCH_PROJECT_INCLUDE,
  });
}

export async function getResearchDocumentMarkdown(
  projectId: string,
  options?: { refresh?: boolean }
): Promise<{ markdown: string; project: ResearchProject } | null> {
  const project = await fetchResearchProject(projectId);
  if (!project) return null;

  if (!options?.refresh && project.content?.researchDocument) {
    return { markdown: project.content.researchDocument, project };
  }

  const markdown = buildResearchDocumentMarkdown(project);
  await cacheResearchDocument(projectId, markdown);
  return { markdown, project };
}

export async function cacheResearchDocument(projectId: string, markdown?: string): Promise<string> {
  const project = await fetchResearchProject(projectId);
  if (!project) throw new Error("Project not found");

  const doc = markdown ?? buildResearchDocumentMarkdown(project);

  if (project.content) {
    await prisma.content.update({
      where: { projectId },
      data: { researchDocument: doc },
    });
  } else {
    await prisma.content.create({
      data: { projectId, researchDocument: doc },
    });
  }

  return doc;
}

export function researchExportFilename(project: Pick<ResearchProject, "name">, ext: "pdf" | "md"): string {
  return `${slugifyProjectName(project.name)}-research.${ext}`;
}
