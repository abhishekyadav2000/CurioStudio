import { generateJSON, getLLMConfig, getProviderForTask } from "../llm";
import { CONTENT_GENERATION_SYSTEM_PROMPT } from "../llm/prompts";
import type { ProjectMetadata } from "../importer/types";
import type { AnalysisResult } from "../analyzer";
import type { ScanResult } from "../scanner";
import type { SandboxRunResult } from "../sandbox";

export interface PresentationSlide {
  id: string;
  title: string;
  body: string;
  speakerNotes: string;
  durationSec: number;
}

export interface ContentOutput {
  youtubeTitle: string;
  hook: string;
  script5min: string;
  script10min: string;
  thumbnailIdea: string;
  description: string;
  hashtags: string[];
  linkedinPost: string;
  shortsScript: string;
  simpleExplanation: string;
  technicalExplanation: string;
  presentationSlides: PresentationSlide[];
  notebookLmBrief: string;
  recordingOutline: string;
}

interface AIContentResponse {
  youtubeTitle?: string;
  hook?: string;
  script5min?: string;
  script10min?: string;
  thumbnailIdea?: string;
  description?: string;
  hashtags?: string[];
  linkedinPost?: string;
  shortsScript?: string;
  simpleExplanation?: string;
  technicalExplanation?: string;
  presentationSlides?: { title: string; body: string; speakerNotes: string; durationSec: number }[];
  notebookLmBrief?: string;
  recordingOutline?: string;
}

export async function generateContent(
  metadata: ProjectMetadata,
  scan: ScanResult,
  sandbox: SandboxRunResult,
  analysis: AnalysisResult
): Promise<ContentOutput> {
  const template = generateTemplate(metadata, scan, sandbox, analysis);

  const config = await getLLMConfig();
  const provider = getProviderForTask(config, "script");
  if (provider === "template") return template;

  const context = buildContext(metadata, scan, sandbox, analysis);
  const aiResult = await generateJSON<AIContentResponse>(
    [
      {
        role: "system",
        content: CONTENT_GENERATION_SYSTEM_PROMPT,
      },
      { role: "user", content: context },
    ],
    "script"
  );

  if (!aiResult) return template;

  return {
    youtubeTitle: aiResult.youtubeTitle ?? template.youtubeTitle,
    hook: aiResult.hook ?? template.hook,
    script5min: aiResult.script5min ?? template.script5min,
    script10min: aiResult.script10min ?? template.script10min,
    thumbnailIdea: aiResult.thumbnailIdea ?? template.thumbnailIdea,
    description: aiResult.description ?? template.description,
    hashtags: aiResult.hashtags ?? template.hashtags,
    linkedinPost: aiResult.linkedinPost ?? template.linkedinPost,
    shortsScript: aiResult.shortsScript ?? template.shortsScript,
    simpleExplanation: aiResult.simpleExplanation ?? template.simpleExplanation,
    technicalExplanation: aiResult.technicalExplanation ?? template.technicalExplanation,
    presentationSlides: (aiResult.presentationSlides ?? template.presentationSlides).map((s, i) => ({
      id: `slide-${i + 1}`,
      title: s.title,
      body: s.body,
      speakerNotes: s.speakerNotes,
      durationSec: s.durationSec ?? 45,
    })),
    notebookLmBrief: aiResult.notebookLmBrief ?? template.notebookLmBrief,
    recordingOutline: aiResult.recordingOutline ?? template.recordingOutline,
  };
}

function generateTemplate(
  metadata: ProjectMetadata,
  scan: ScanResult,
  sandbox: SandboxRunResult,
  analysis: AnalysisResult
): ContentOutput {
  const title = templateTitle(metadata);
  const hook = templateHook(metadata);

  const script5min = `## HOOK (0:00-0:15)
${hook}

## WHAT IS IT (0:15-1:00)
${analysis.whatItDoes}

Today we're safely testing **${metadata.fullName}** — ${metadata.stars.toLocaleString()} stars on GitHub.

## THE PROBLEM IT SOLVES (1:00-2:00)
${analysis.problemSolved}

Tech stack: ${scan.detectedStack.join(", ") || "See README"}

## SAFE TESTING (2:00-3:00)
I did NOT run this on my Mac. I used CurioStudio — an isolated cloud sandbox.

Risk score: ${scan.riskScore}/100 (${scan.riskLevel})
Install command: \`${sandbox.installCommand}\`
${sandbox.status === "completed" ? "Install succeeded" : sandbox.status === "simulated" ? "Simulated run — add E2B_API_KEY for real execution" : "Install failed"}

## PROS & CONS (3:00-4:00)
Pros: ${analysis.pros.join("; ") || "TBD"}
Cons: ${analysis.cons.join("; ") || "None major"}

## VERDICT (4:00-5:00)
Overall score: ${analysis.overallScore}/100
Video worthiness: ${analysis.videoWorthiness}/100
${analysis.recommendation}

Link: ${metadata.cloneUrl.replace(".git", "")}
Subscribe for daily project reviews!`;

  const script10min = `${script5min}

## DEEP DIVE (5:00-8:00)
### Setup Steps
${analysis.setupSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

### What Worked
${analysis.whatWorked}

### What Failed
${analysis.whatFailed}

### Security Notes
${scan.suspiciousFiles.length ? `Suspicious patterns: ${scan.suspiciousFiles.join(", ")}` : "No major red flags in pre-run scan."}
Vulnerabilities found: ${scan.vulnerabilities.length}

## OUTRO (8:00-10:00)
Would you use ${metadata.name}? Comment below.
Tomorrow: another project, tested safely.`;

  const presentationSlides = buildPresentationSlides(metadata, scan, sandbox, analysis, hook);
  const notebookLmBrief = buildNotebookBrief(metadata, scan, analysis);
  const recordingOutline = buildRecordingOutline(metadata, analysis, hook);

  return {
    youtubeTitle: title,
    hook,
    script5min,
    script10min,
    thumbnailIdea: templateThumbnail(metadata),
    description: templateDescription(metadata, analysis),
    hashtags: templateHashtags(metadata, scan),
    linkedinPost: templateLinkedIn(metadata, analysis),
    shortsScript: templateShorts(metadata, hook, analysis),
    simpleExplanation: `${metadata.name} is ${analysis.whatItDoes}. It uses ${scan.detectedStack.slice(0, 3).join(", ") || "various technologies"} and has ${metadata.stars} stars on GitHub.`,
    technicalExplanation: `Stack: ${scan.detectedStack.join(", ")}. Risk: ${scan.riskLevel}. Dependencies: ${scan.dependencyFiles.join(", ")}. Install: \`${sandbox.installCommand}\`. ${analysis.recommendation}`,
    presentationSlides,
    notebookLmBrief,
    recordingOutline,
  };
}

function buildPresentationSlides(
  m: ProjectMetadata,
  scan: ScanResult,
  sandbox: SandboxRunResult,
  a: AnalysisResult,
  hook: string
): PresentationSlide[] {
  return [
    { id: "slide-1", title: m.name, body: hook, speakerNotes: "Open with energy. Look at camera.", durationSec: 15 },
    { id: "slide-2", title: "What Is It?", body: a.whatItDoes ?? m.description ?? "", speakerNotes: "Explain in plain English for non-devs too.", durationSec: 60 },
    { id: "slide-3", title: "The Problem", body: a.problemSolved ?? "", speakerNotes: "Why would someone need this?", durationSec: 45 },
    { id: "slide-4", title: "Tech Stack", body: scan.detectedStack.join(" · ") || m.language || "See README", speakerNotes: `Stars: ${m.stars}. License: ${m.license ?? "unknown"}`, durationSec: 45 },
    { id: "slide-5", title: "Safe Sandbox Test", body: `Risk: ${scan.riskLevel} (${scan.riskScore}/100)\nInstall: ${sandbox.installCommand}`, speakerNotes: "Emphasize you did NOT run on your Mac.", durationSec: 60 },
    { id: "slide-6", title: "Pros & Cons", body: `✓ ${a.pros.slice(0, 3).join("\n✓ ")}\n✗ ${a.cons.slice(0, 2).join("\n✗ ")}`, speakerNotes: "Be honest — builds trust.", durationSec: 60 },
    { id: "slide-7", title: "Verdict", body: `Score: ${a.overallScore}/100\n${a.recommendation}`, speakerNotes: "Give clear recommendation.", durationSec: 45 },
    { id: "slide-8", title: "Try It Yourself", body: m.cloneUrl.replace(".git", ""), speakerNotes: "CTA: subscribe, comment, tomorrow's project tease.", durationSec: 30 },
  ];
}

function buildNotebookBrief(m: ProjectMetadata, scan: ScanResult, a: AnalysisResult): string {
  return `# ${m.fullName} — NotebookLM Research Brief

## Overview
${a.whatItDoes ?? m.description}

## Key Features
${a.pros.map((p) => `- ${p}`).join("\n")}

## Tech Stack
${scan.detectedStack.join(", ") || m.language || "Unknown"}

## Problem It Solves
${a.problemSolved}

## Setup Steps
${a.setupSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Demo Flow (for recording)
1. Show GitHub page and star count (${m.stars})
2. Explain what the project does in 30 seconds
3. Walk through README install steps
4. Show sandbox test results (risk: ${scan.riskLevel})
5. Live demo or screenshot walkthrough
6. Pros, cons, and final verdict (${a.overallScore}/100)

## Talking Points
- Tested safely in isolated sandbox, not on personal laptop
- ${a.recommendation}
- ${a.whatWorked}
- Watch out for: ${a.whatFailed}

## Audience Questions to Address
- Is it safe to use?
- How hard is setup? (${a.installDifficulty}/10)
- Who is this for?
- Better alternatives?

## Source
${m.cloneUrl}`;
}

function buildRecordingOutline(m: ProjectMetadata, a: AnalysisResult, hook: string): string {
  return `[0:00] HOOK
${hook}

[0:15] INTRO — ${m.name}
${a.whatItDoes}

[1:00] THE PROBLEM
${a.problemSolved}

[2:00] SANDBOX TEST
I tested this in CurioStudio — isolated cloud sandbox, not my Mac.

[3:00] PROS
${a.pros.map((p) => `• ${p}`).join("\n")}

[3:45] CONS
${a.cons.map((c) => `• ${c}`).join("\n")}

[4:30] VERDICT — ${a.overallScore}/100
${a.recommendation}

[5:00] OUTRO
Link in description. Subscribe for daily reviews.`;
}

function buildContext(
  metadata: ProjectMetadata,
  scan: ScanResult,
  sandbox: SandboxRunResult,
  analysis: AnalysisResult
): string {
  return JSON.stringify({
    project: metadata.fullName,
    description: metadata.description,
    stars: metadata.stars,
    stack: scan.detectedStack,
    risk: { score: scan.riskScore, level: scan.riskLevel },
    sandbox: { status: sandbox.status, install: sandbox.installCommand },
    analysis,
    readme_excerpt: metadata.readme?.slice(0, 2000),
  });
}

function templateTitle(m: ProjectMetadata): string {
  return `I Tested ${m.name} Safely So You Don't Have To (${m.stars > 1000 ? "Popular" : "Hidden Gem"})`;
}

function templateHook(m: ProjectMetadata): string {
  return `What if you could test any GitHub project without risking your laptop? I found ${m.name} — ${m.stars.toLocaleString()} developers already use it. Let me show you what it actually does.`;
}

function templateThumbnail(m: ProjectMetadata): string {
  return `Split screen: "${m.name}" on dark background with green "SAFE TEST" badge. Bold overlay: "TESTED IN SANDBOX". Navy + electric green.`;
}

function templateDescription(m: ProjectMetadata, a: AnalysisResult): string {
  return `I safely tested ${m.fullName} in an isolated cloud sandbox.

${m.stars.toLocaleString()} stars | Score: ${a.overallScore}/100

${m.description ?? ""}

${m.cloneUrl.replace(".git", "")}

#OpenSource #DevTools #GitHub #EverydaySeries`;
}

function templateHashtags(_m: ProjectMetadata, scan: ScanResult): string[] {
  const tags = ["OpenSource", "GitHub", "DevTools", "Coding", "EverydaySeries", "CurioStudio"];
  if (scan.detectedStack.includes("Python")) tags.push("Python");
  if (scan.detectedStack.includes("AI") || scan.detectedStack.includes("PyTorch")) tags.push("AI", "MachineLearning");
  if (scan.detectedStack.includes("Next.js")) tags.push("NextJS", "WebDev");
  return tags.slice(0, 12);
}

function templateLinkedIn(m: ProjectMetadata, a: AnalysisResult): string {
  return `Tested ${m.fullName} today in an isolated sandbox.

${a.whatItDoes}

Score: ${a.overallScore}/100 | ${a.recommendation}

${m.cloneUrl.replace(".git", "")}`;
}

function templateShorts(m: ProjectMetadata, hook: string, a: AnalysisResult): string {
  return `[0-3s] ${hook.split(".")[0]}.
[3-15s] ${m.name}. ${a.whatItDoes.slice(0, 100)}
[15-25s] Tested in cloud sandbox — NOT on my Mac. Score: ${a.overallScore}/100.
[25-30s] Full review on my channel!`;
}
