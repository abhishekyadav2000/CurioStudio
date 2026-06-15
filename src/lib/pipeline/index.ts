import { prisma } from "@/lib/db";
import { importProject } from "@/lib/importer";
import { detectSource, isSupportedMvp } from "@/lib/importer/detect-source";
import { scanRepository } from "@/lib/scanner";
import { runInSandbox } from "@/lib/sandbox";
import { analyzeProject } from "@/lib/analyzer";
import { generateContent } from "@/lib/content";
import { cacheResearchDocument } from "@/lib/research-document";
import { ProjectStatus } from "@prisma/client";

import { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from "./constants";
export { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from "./constants";

interface PipelineLogEntry {
  stage: PipelineStage;
  at: string;
  message: string;
}

async function appendJobLog(jobId: string, stage: PipelineStage, message: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { pipelineLog: true } });
  const prev: PipelineLogEntry[] = job?.pipelineLog ? JSON.parse(job.pipelineLog) : [];
  prev.push({ stage, at: new Date().toISOString(), message });
  await prisma.job.update({
    where: { id: jobId },
    data: { stage, pipelineLog: JSON.stringify(prev) },
  });
}

export async function runProjectPipeline(url: string, jobId?: string): Promise<string> {
  const log = async (stage: PipelineStage, message: string) => {
    if (jobId) await appendJobLog(jobId, stage, message);
  };

  await log("import", `Detecting source for ${url}`);
  const parsed = detectSource(url);
  if (!isSupportedMvp(parsed)) {
    throw new Error(`${parsed.source} is not supported yet`);
  }

  await log("import", `Importing from ${parsed.source}`);
  const { result } = await importProject(url);
  if (!result) throw new Error("Failed to import project");

  const { metadata, techStack } = result;

  const existing = await prisma.project.findFirst({
    where: { url: parsed.rawUrl },
    orderBy: { createdAt: "desc" },
    include: { content: true },
  });
  if (existing?.content) {
    await log("content", "Existing project with content — skipping");
    return existing.id;
  }

  const project = existing ?? (await prisma.project.create({
    data: {
      url: parsed.rawUrl,
      source: parsed.source,
      status: "FOUND",
      name: metadata.name,
      description: metadata.description,
      owner: metadata.owner,
      stars: metadata.stars,
      language: metadata.language,
      license: metadata.license,
      lastCommit: metadata.lastCommit ? new Date(metadata.lastCommit) : null,
      readme: metadata.readme,
      techStack: JSON.stringify(techStack),
      metadata: JSON.stringify({ topics: metadata.topics, cloneUrl: metadata.cloneUrl }),
    },
  }));

  await log("scan", "Running security scan and dependency check");
  const scanResult = await scanRepository(metadata, techStack, parsed.source);
  await prisma.scan.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      riskScore: scanResult.riskScore,
      riskLevel: scanResult.riskLevel,
      detectedStack: JSON.stringify(scanResult.detectedStack),
      dependencyFiles: JSON.stringify(scanResult.dependencyFiles),
      suspiciousFiles: JSON.stringify(scanResult.suspiciousFiles),
      vulnerabilities: JSON.stringify(scanResult.vulnerabilities),
      installScripts: JSON.stringify(scanResult.installScripts),
      networkCalls: JSON.stringify(scanResult.networkCalls),
      licenseInfo: scanResult.licenseInfo,
      openIssues: scanResult.openIssues,
      lastCommitDays: scanResult.lastCommitDays,
      scanLog: scanResult.scanLog,
      rawReport: JSON.stringify(scanResult.rawReport),
    },
    update: {
      riskScore: scanResult.riskScore,
      riskLevel: scanResult.riskLevel,
      detectedStack: JSON.stringify(scanResult.detectedStack),
      dependencyFiles: JSON.stringify(scanResult.dependencyFiles),
      suspiciousFiles: JSON.stringify(scanResult.suspiciousFiles),
      vulnerabilities: JSON.stringify(scanResult.vulnerabilities),
      installScripts: JSON.stringify(scanResult.installScripts),
      networkCalls: JSON.stringify(scanResult.networkCalls),
      licenseInfo: scanResult.licenseInfo,
      openIssues: scanResult.openIssues,
      lastCommitDays: scanResult.lastCommitDays,
      scanLog: scanResult.scanLog,
      rawReport: JSON.stringify(scanResult.rawReport),
    },
  });
  await prisma.project.update({ where: { id: project.id }, data: { status: "SCANNED" } });
  await log("scan", `Scan complete — risk ${scanResult.riskLevel} (${scanResult.riskScore}/100)`);

  await log("sandbox", "Running safe sandbox: clone → install → smoke test");
  const sandboxResult = await runInSandbox(metadata, scanResult, parsed.source);
  await prisma.sandbox.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      sandboxId: sandboxResult.sandboxId,
      provider: sandboxResult.provider,
      status: sandboxResult.status,
      verdict: sandboxResult.verdict,
      smokeTest: sandboxResult.smokeTest ? JSON.stringify(sandboxResult.smokeTest) : null,
      installCommand: sandboxResult.installCommand,
      runCommand: sandboxResult.runCommand,
      logs: sandboxResult.logs,
      errors: sandboxResult.errors,
      exitCode: sandboxResult.exitCode,
      durationMs: sandboxResult.durationMs,
      completedAt: new Date(),
    },
    update: {
      sandboxId: sandboxResult.sandboxId,
      provider: sandboxResult.provider,
      status: sandboxResult.status,
      verdict: sandboxResult.verdict,
      smokeTest: sandboxResult.smokeTest ? JSON.stringify(sandboxResult.smokeTest) : null,
      installCommand: sandboxResult.installCommand,
      runCommand: sandboxResult.runCommand,
      logs: sandboxResult.logs,
      errors: sandboxResult.errors,
      exitCode: sandboxResult.exitCode,
      durationMs: sandboxResult.durationMs,
      completedAt: new Date(),
    },
  });

  const projectStatus: ProjectStatus =
    sandboxResult.status === "failed"
      ? "INSTALL_FAILED"
      : sandboxResult.status === "simulated"
        ? "SANDBOX_CREATED"
        : "INSTALL_SUCCESSFUL";

  await prisma.project.update({ where: { id: project.id }, data: { status: projectStatus } });
  await log(
    "sandbox",
    `Sandbox ${sandboxResult.verdict} (${sandboxResult.provider}, ${(sandboxResult.durationMs / 1000).toFixed(1)}s)`
  );

  await log("analyze", "Scoring project with review criteria");
  const analysis = analyzeProject(metadata, scanResult, sandboxResult);
  await prisma.scorecard.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      whatItDoes: analysis.whatItDoes,
      problemSolved: analysis.problemSolved,
      installDifficulty: analysis.installDifficulty,
      usefulnessScore: analysis.usefulnessScore,
      videoWorthiness: analysis.videoWorthiness,
      pros: JSON.stringify(analysis.pros),
      cons: JSON.stringify(analysis.cons),
      whatWorked: analysis.whatWorked,
      whatFailed: analysis.whatFailed,
      setupSteps: JSON.stringify(analysis.setupSteps),
      overallScore: analysis.overallScore,
      recommendation: analysis.recommendation,
    },
    update: {
      whatItDoes: analysis.whatItDoes,
      problemSolved: analysis.problemSolved,
      installDifficulty: analysis.installDifficulty,
      usefulnessScore: analysis.usefulnessScore,
      videoWorthiness: analysis.videoWorthiness,
      pros: JSON.stringify(analysis.pros),
      cons: JSON.stringify(analysis.cons),
      whatWorked: analysis.whatWorked,
      whatFailed: analysis.whatFailed,
      setupSteps: JSON.stringify(analysis.setupSteps),
      overallScore: analysis.overallScore,
      recommendation: analysis.recommendation,
    },
  });
  await prisma.project.update({ where: { id: project.id }, data: { status: "REVIEWED" } });
  await log("analyze", `Review score ${analysis.overallScore}/100 — ${analysis.recommendation.slice(0, 80)}`);

  await log("content", "Generating scripts and marketing content");
  const contentOutput = await generateContent(metadata, scanResult, sandboxResult, analysis);
  await prisma.content.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      youtubeTitle: contentOutput.youtubeTitle,
      hook: contentOutput.hook,
      script5min: contentOutput.script5min,
      script10min: contentOutput.script10min,
      thumbnailIdea: contentOutput.thumbnailIdea,
      description: contentOutput.description,
      hashtags: JSON.stringify(contentOutput.hashtags),
      linkedinPost: contentOutput.linkedinPost,
      shortsScript: contentOutput.shortsScript,
      simpleExplanation: contentOutput.simpleExplanation,
      technicalExplanation: contentOutput.technicalExplanation,
      presentationSlides: JSON.stringify(contentOutput.presentationSlides),
      notebookLmBrief: contentOutput.notebookLmBrief,
      recordingOutline: contentOutput.recordingOutline,
    },
    update: {
      youtubeTitle: contentOutput.youtubeTitle,
      hook: contentOutput.hook,
      script5min: contentOutput.script5min,
      script10min: contentOutput.script10min,
      thumbnailIdea: contentOutput.thumbnailIdea,
      description: contentOutput.description,
      hashtags: JSON.stringify(contentOutput.hashtags),
      linkedinPost: contentOutput.linkedinPost,
      shortsScript: contentOutput.shortsScript,
      simpleExplanation: contentOutput.simpleExplanation,
      technicalExplanation: contentOutput.technicalExplanation,
      presentationSlides: JSON.stringify(contentOutput.presentationSlides),
      notebookLmBrief: contentOutput.notebookLmBrief,
      recordingOutline: contentOutput.recordingOutline,
    },
  });
  await prisma.project.update({ where: { id: project.id }, data: { status: "SCRIPT_READY", workflowStep: "SCRIPT" } });
  await log("content", "Scripts ready");

  await cacheResearchDocument(project.id);
  await log("content", "Research document cached for PDF export");

  return project.id;
}

export async function rerunSandboxTest(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { scan: true },
  });
  if (!project || !project.scan) throw new Error("Project or scan not found");

  const meta = project.metadata ? JSON.parse(project.metadata) : {};
  const metadata: import("../importer/types").ProjectMetadata = {
    name: project.name ?? "",
    description: project.description ?? "",
    owner: project.owner ?? "",
    fullName: project.name ?? project.url,
    stars: project.stars ?? 0,
    language: project.language,
    license: project.license,
    lastCommit: project.lastCommit?.toISOString() ?? null,
    readme: project.readme,
    topics: meta.topics ?? [],
    cloneUrl: meta.cloneUrl ?? project.url,
    openIssues: project.scan.openIssues ?? 0,
    homepage: project.url,
    defaultBranch: "main",
  };

  const scanResult = {
    riskScore: project.scan.riskScore,
    riskLevel: project.scan.riskLevel as "low" | "medium" | "high" | "critical" | "unknown",
    detectedStack: project.techStack ? JSON.parse(project.techStack) : [],
    dependencyFiles: project.scan.dependencyFiles ? JSON.parse(project.scan.dependencyFiles) : [],
    suspiciousFiles: project.scan.suspiciousFiles ? JSON.parse(project.scan.suspiciousFiles) : [],
    vulnerabilities: project.scan.vulnerabilities ? JSON.parse(project.scan.vulnerabilities) : [],
    installScripts: project.scan.installScripts ? JSON.parse(project.scan.installScripts) : [],
    networkCalls: project.scan.networkCalls ? JSON.parse(project.scan.networkCalls) : [],
    licenseInfo: project.scan.licenseInfo,
    openIssues: project.scan.openIssues ?? 0,
    lastCommitDays: project.scan.lastCommitDays,
    scanLog: project.scan.scanLog ?? "",
    rawReport: {},
  };

  const sandboxResult = await runInSandbox(metadata, scanResult, project.source);
  await prisma.sandbox.upsert({
    where: { projectId },
    create: {
      projectId,
      sandboxId: sandboxResult.sandboxId,
      provider: sandboxResult.provider,
      status: sandboxResult.status,
      verdict: sandboxResult.verdict,
      smokeTest: sandboxResult.smokeTest ? JSON.stringify(sandboxResult.smokeTest) : null,
      installCommand: sandboxResult.installCommand,
      runCommand: sandboxResult.runCommand,
      logs: sandboxResult.logs,
      errors: sandboxResult.errors,
      exitCode: sandboxResult.exitCode,
      durationMs: sandboxResult.durationMs,
      completedAt: new Date(),
    },
    update: {
      sandboxId: sandboxResult.sandboxId,
      provider: sandboxResult.provider,
      status: sandboxResult.status,
      verdict: sandboxResult.verdict,
      smokeTest: sandboxResult.smokeTest ? JSON.stringify(sandboxResult.smokeTest) : null,
      installCommand: sandboxResult.installCommand,
      runCommand: sandboxResult.runCommand,
      logs: sandboxResult.logs,
      errors: sandboxResult.errors,
      exitCode: sandboxResult.exitCode,
      durationMs: sandboxResult.durationMs,
      completedAt: new Date(),
    },
  });

  const projectStatus: ProjectStatus =
    sandboxResult.status === "failed"
      ? "INSTALL_FAILED"
      : sandboxResult.status === "simulated"
        ? "SANDBOX_CREATED"
        : "INSTALL_SUCCESSFUL";

  await prisma.project.update({ where: { id: projectId }, data: { status: projectStatus } });
}

export async function processNextJob(): Promise<{
  processed: boolean;
  jobId?: string;
  projectId?: string;
  error?: string;
  stage?: string;
}> {
  const job = await prisma.job.findFirst({
    where: { status: "PENDING" },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  if (!job) return { processed: false };

  await prisma.job.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date(), stage: "import", pipelineLog: "[]" },
  });

  try {
    const projectId = await runProjectPipeline(job.url, job.id);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "COMPLETED", projectId, stage: "content", completedAt: new Date() },
    });

    await prisma.trendingEntry.updateMany({
      where: { url: job.url },
      data: { imported: true, projectId },
    });

    return { processed: true, jobId: job.id, projectId, stage: "content" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "FAILED", error: message, completedAt: new Date() },
    });
    return { processed: true, jobId: job.id, error: message };
  }
}

export async function enqueueUrls(
  urls: string[],
  source: string = "manual"
): Promise<{ jobIds: string[]; skipped: string[] }> {
  const jobIds: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    if (!url) continue;

    const existingJob = await prisma.job.findFirst({
      where: { url, status: { in: ["PENDING", "PROCESSING"] } },
    });
    if (existingJob) {
      skipped.push(url);
      continue;
    }

    const existingProject = await prisma.project.findFirst({ where: { url } });
    if (existingProject) {
      skipped.push(url);
      continue;
    }

    const job = await prisma.job.create({
      data: { url, source, position: i },
    });
    jobIds.push(job.id);
  }

  return { jobIds, skipped };
}
