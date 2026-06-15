import type { ProjectMetadata } from "../importer/types";
import type { ScanResult } from "../scanner";
import type { SandboxRunResult } from "../sandbox";

export interface AnalysisResult {
  whatItDoes: string;
  problemSolved: string;
  installDifficulty: number;
  usefulnessScore: number;
  videoWorthiness: number;
  pros: string[];
  cons: string[];
  whatWorked: string;
  whatFailed: string;
  setupSteps: string[];
  overallScore: number;
  recommendation: string;
}

export function analyzeProject(
  metadata: ProjectMetadata,
  scan: ScanResult,
  sandbox: SandboxRunResult
): AnalysisResult {
  const installVerified = sandbox.status === "completed";
  const installSimulated = sandbox.status === "simulated";
  const installOk = installVerified || installSimulated;
  const hasStars = metadata.stars > 100;
  const recentActivity = scan.lastCommitDays !== null && scan.lastCommitDays < 90;
  const lowRisk = scan.riskLevel === "low" || scan.riskLevel === "unknown";

  const pros: string[] = [];
  const cons: string[] = [];

  if (hasStars) pros.push(`${metadata.stars.toLocaleString()} GitHub stars — community validated`);
  if (recentActivity) pros.push("Active development — commits within 90 days");
  if (metadata.license) pros.push(`Open license: ${metadata.license}`);
  if (scan.detectedStack.length) pros.push(`Modern stack: ${scan.detectedStack.slice(0, 4).join(", ")}`);
  if (lowRisk) pros.push("Low pre-run risk score");

  if (scan.riskLevel === "high" || scan.riskLevel === "critical") {
    cons.push(`High risk score (${scan.riskScore}/100) — review carefully`);
  }
  if (scan.suspiciousFiles.length) cons.push(`${scan.suspiciousFiles.length} suspicious patterns detected`);
  if (sandbox.status === "failed") cons.push("Install failed in sandbox");
  if (installSimulated) cons.push("Sandbox simulated — install/run not verified (add E2B_API_KEY)");
  if (scan.lastCommitDays !== null && scan.lastCommitDays > 365) cons.push("Stale project — no recent commits");
  if (!metadata.readme || metadata.readme.length < 200) cons.push("Sparse README — hard to evaluate");

  const installDifficulty = estimateInstallDifficulty(scan, sandbox);
  const usefulnessScore = estimateUsefulness(metadata, scan);
  const videoWorthiness = estimateVideoWorthiness(metadata, scan, sandbox, usefulnessScore);

  const whatWorked = installVerified
    ? `Verified in E2B sandbox. Install: \`${sandbox.installCommand}\`. Stack: ${scan.detectedStack.join(", ") || "unknown"}.`
    : installSimulated
      ? `Simulation only — planned install: \`${sandbox.installCommand}\`. Security scan ran; execution not verified.`
      : "Could not complete install in sandbox.";

  const whatFailed =
    sandbox.errors ||
    (scan.suspiciousFiles.length ? `Suspicious: ${scan.suspiciousFiles.slice(0, 3).join("; ")}` : "No critical failures");

  const setupSteps = extractSetupSteps(metadata.readme);

  const overallScore = Math.round(
    usefulnessScore * 0.35 +
      (100 - scan.riskScore) * 0.25 +
      (installVerified ? 80 : installSimulated ? 35 : 20) * 0.2 +
      videoWorthiness * 0.2
  );

  let recommendation: string;
  if (overallScore >= 70 && lowRisk) {
    recommendation = "Strong candidate for a video — test further in sandbox and record.";
  } else if (overallScore >= 50) {
    recommendation = "Worth exploring — document setup issues for educational content.";
  } else if (scan.riskLevel === "critical") {
    recommendation = "Skip or cover as a security cautionary tale only.";
  } else {
    recommendation = "Low priority — save for a slow day or skip.";
  }

  return {
    whatItDoes: metadata.description || inferPurpose(metadata),
    problemSolved: inferProblem(metadata, scan),
    installDifficulty,
    usefulnessScore,
    videoWorthiness,
    pros,
    cons,
    whatWorked,
    whatFailed,
    setupSteps,
    overallScore,
    recommendation,
  };
}

function inferPurpose(metadata: ProjectMetadata): string {
  if (metadata.description) return metadata.description;
  const topics = metadata.topics?.join(", ");
  return topics
    ? `A ${metadata.language ?? "software"} project tagged with: ${topics}`
    : `${metadata.name} — purpose unclear from metadata, inspect README.`;
}

function inferProblem(metadata: ProjectMetadata, scan: ScanResult): string {
  const stack = scan.detectedStack.join(", ");
  if (stack.includes("AI") || stack.includes("PyTorch") || stack.includes("LangChain")) {
    return "Addresses AI/ML workflow challenges for developers.";
  }
  if (stack.includes("Next.js") || stack.includes("React")) {
    return "Simplifies web development workflows.";
  }
  return `Targets developers working with ${metadata.language ?? "this stack"}.`;
}

function estimateInstallDifficulty(scan: ScanResult, sandbox: SandboxRunResult): number {
  let score = 3;
  if (scan.dependencyFiles.length > 3) score += 2;
  if (scan.installScripts.length) score += 2;
  if (sandbox.status === "failed") score += 3;
  if (scan.detectedStack.includes("Docker")) score += 1;
  return Math.min(score, 10);
}

function estimateUsefulness(metadata: ProjectMetadata, scan: ScanResult): number {
  let score = 40;
  if (metadata.stars > 1000) score += 25;
  else if (metadata.stars > 100) score += 15;
  else if (metadata.stars > 10) score += 5;
  if (scan.detectedStack.length >= 3) score += 10;
  if (metadata.readme && metadata.readme.length > 500) score += 10;
  if (scan.lastCommitDays !== null && scan.lastCommitDays < 30) score += 10;
  return Math.min(score, 100);
}

function estimateVideoWorthiness(
  metadata: ProjectMetadata,
  scan: ScanResult,
  sandbox: SandboxRunResult,
  usefulness: number
): number {
  let score = usefulness * 0.5;
  if (metadata.stars > 500) score += 15;
  if (scan.detectedStack.some((s) => ["AI", "PyTorch", "LangChain", "Next.js", "Hugging Face"].includes(s))) {
    score += 15;
  }
  if (sandbox.status === "completed") score += 10;
  if (scan.riskLevel === "critical") score -= 30;
  return Math.max(0, Math.min(Math.round(score), 100));
}

function extractSetupSteps(readme: string | null): string[] {
  if (!readme) return ["Clone the repository", "Check README for install instructions", "Run in isolated sandbox"];
  const steps: string[] = [];
  const lines = readme.split("\n");
  let inInstall = false;

  for (const line of lines) {
    if (/^#+\s*(install|setup|getting started|quick start)/i.test(line)) {
      inInstall = true;
      continue;
    }
    if (inInstall && /^#+\s/.test(line) && !/install|setup/i.test(line)) break;
    if (inInstall && (/^\d+\.|^-\s|^```/.test(line) || line.startsWith("npm") || line.startsWith("pip"))) {
      const cleaned = line.replace(/^[\d.\-\s]+/, "").trim();
      if (cleaned && cleaned.length < 120) steps.push(cleaned);
    }
  }

  if (!steps.length) {
    return ["Clone the repository", "Install dependencies per README", "Run in CurioStudio sandbox"];
  }
  return steps.slice(0, 8);
}
