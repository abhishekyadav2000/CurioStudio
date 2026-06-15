import { exec } from "child_process";
import { promisify } from "util";
import type { ProjectMetadata } from "../importer/types";
import type { ProjectSource } from "@prisma/client";

const execAsync = promisify(exec);

export interface ScanResult {
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical" | "unknown";
  detectedStack: string[];
  dependencyFiles: string[];
  suspiciousFiles: string[];
  vulnerabilities: Vulnerability[];
  installScripts: string[];
  networkCalls: string[];
  licenseInfo: string | null;
  openIssues: number;
  lastCommitDays: number | null;
  scanLog: string;
  rawReport: Record<string, unknown>;
}

export interface Vulnerability {
  id: string;
  package?: string;
  severity: string;
  summary: string;
  source: "trivy" | "osv" | "heuristic";
}

const SUSPICIOUS_PATTERNS = [
  { pattern: /curl\s+.*\|\s*(ba)?sh/i, label: "curl pipe to shell" },
  { pattern: /wget\s+.*\|\s*(ba)?sh/i, label: "wget pipe to shell" },
  { pattern: /rm\s+-rf\s+\//i, label: "recursive root delete" },
  { pattern: /chmod\s+777/i, label: "world-writable permissions" },
  { pattern: /eval\s*\(/i, label: "eval() usage" },
  { pattern: /child_process/i, label: "child_process module" },
  { pattern: /crypto.*miner|xmrig|stratum/i, label: "potential crypto miner" },
  { pattern: /\.env\b.*(?:password|secret|key)/i, label: "env credential reference" },
  { pattern: /postinstall/i, label: "postinstall script" },
  { pattern: /preinstall/i, label: "preinstall script" },
];

const DEPENDENCY_FILES = [
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "requirements.txt",
  "Pipfile",
  "pyproject.toml",
  "poetry.lock",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "composer.json",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Makefile",
  "setup.py",
  "setup.sh",
  "install.sh",
];

const NETWORK_PATTERNS = [
  /fetch\s*\(\s*['"`](https?:\/\/[^'"`]+)/gi,
  /axios\.[a-z]+\s*\(\s*['"`](https?:\/\/[^'"`]+)/gi,
  /requests\.(get|post)\s*\(\s*['"`](https?:\/\/[^'"`]+)/gi,
  /urllib\.request/gi,
  /socket\.connect/gi,
  /https?:\/\/[a-zA-Z0-9.-]+\.[a-z]{2,}/g,
];

export async function scanRepository(
  metadata: ProjectMetadata,
  techStack: string[],
  source: ProjectSource = "GITHUB"
): Promise<ScanResult> {
  if (source !== "GITHUB" && source !== "GITLAB") {
    return scanMetadataOnly(metadata, techStack, source);
  }
  const logs: string[] = [];
  const suspiciousFiles: string[] = [];
  const installScripts: string[] = [];
  const networkCalls = new Set<string>();
  const dependencyFiles: string[] = [];

  logs.push(`[scan] Starting pre-run scan for ${metadata.fullName}`);

  // Fetch key files from GitHub API
  const contents = await fetchRepoContents(metadata.owner, metadata.name);
  logs.push(`[scan] Fetched ${contents.length} root-level files`);

  for (const file of contents) {
    if (DEPENDENCY_FILES.includes(file.name)) {
      dependencyFiles.push(file.name);
    }
  }

  // Scan README and fetched file contents
  const textsToScan: { name: string; content: string }[] = [];
  if (metadata.readme) textsToScan.push({ name: "README", content: metadata.readme });

  for (const file of contents.slice(0, 15)) {
    if (file.content) textsToScan.push({ name: file.name, content: file.content });
  }

  for (const { name, content } of textsToScan) {
    for (const { pattern, label } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        suspiciousFiles.push(`${name}: ${label}`);
      }
    }
    if (/postinstall|preinstall|install\.sh|setup\.sh/i.test(content)) {
      installScripts.push(name);
    }
    for (const pattern of NETWORK_PATTERNS) {
      const matches = content.matchAll(pattern);
      for (const m of matches) {
        const url = m[1] || m[0];
        if (url && !url.includes("github.com") && !url.includes("img.shields")) {
          networkCalls.add(url.slice(0, 120));
        }
      }
    }
  }

  // External scanner integration
  const vulnerabilities: Vulnerability[] = [];
  const trivyResults = await runTrivy(metadata.cloneUrl);
  if (trivyResults.length) {
    vulnerabilities.push(...trivyResults);
    logs.push(`[scan] Trivy found ${trivyResults.length} issues`);
  } else {
    logs.push("[scan] Trivy not available or no issues — using heuristics");
    vulnerabilities.push(...heuristicVulnScan(textsToScan));
  }

  const osvResults = await runOsvScanner(contents);
  vulnerabilities.push(...osvResults);

  const lastCommitDays = metadata.lastCommit
    ? Math.floor((Date.now() - new Date(metadata.lastCommit).getTime()) / 86400000)
    : null;

  const riskScore = calculateRiskScore({
    suspiciousCount: suspiciousFiles.length,
    vulnCount: vulnerabilities.length,
    installScriptCount: installScripts.length,
    networkCount: networkCalls.size,
    lastCommitDays,
    openIssues: metadata.openIssues,
  });

  const riskLevel = scoreToLevel(riskScore);

  logs.push(`[scan] Risk score: ${riskScore}/100 (${riskLevel})`);

  return {
    riskScore,
    riskLevel,
    detectedStack: techStack,
    dependencyFiles,
    suspiciousFiles,
    vulnerabilities,
    installScripts,
    networkCalls: Array.from(networkCalls),
    licenseInfo: metadata.license,
    openIssues: metadata.openIssues,
    lastCommitDays,
    scanLog: logs.join("\n"),
    rawReport: { contents: contents.map((c) => c.name), scannedAt: new Date().toISOString() },
  };
}

interface RepoFile {
  name: string;
  content: string | null;
  type: string;
}

async function fetchRepoContents(owner: string, repo: string): Promise<RepoFile[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CurioStudio",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
    if (!res.ok) return [];
    const items = await res.json();
    const files: RepoFile[] = [];

    for (const item of items.slice(0, 20)) {
      if (item.type === "file" && item.size < 100000) {
        const fileRes = await fetch(item.download_url, { headers });
        const content = fileRes.ok ? await fileRes.text() : null;
        files.push({ name: item.name, content, type: item.type });
      } else {
        files.push({ name: item.name, content: null, type: item.type });
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function runTrivy(cloneUrl: string): Promise<Vulnerability[]> {
  const trivyPath = process.env.TRIVY_PATH || "trivy";
  try {
    const { stdout } = await execAsync(
      `${trivyPath} repo --scanners vuln,misconfig,secret --format json --quiet "${cloneUrl}"`,
      { timeout: 120000 }
    );
    const report = JSON.parse(stdout);
    const vulns: Vulnerability[] = [];
    for (const result of report.Results ?? []) {
      for (const v of result.Vulnerabilities ?? []) {
        vulns.push({
          id: v.VulnerabilityID || v.ID || "unknown",
          package: v.PkgName,
          severity: v.Severity || "UNKNOWN",
          summary: v.Title || v.Description || "No description",
          source: "trivy",
        });
      }
    }
    return vulns.slice(0, 50);
  } catch {
    return [];
  }
}

async function runOsvScanner(files: RepoFile[]): Promise<Vulnerability[]> {
  const osvPath = process.env.OSV_SCANNER_PATH || "osv-scanner";
  const lockfiles = files.filter((f) =>
    ["package-lock.json", "yarn.lock", "requirements.txt", "poetry.lock"].includes(f.name)
  );
  if (!lockfiles.length) return [];

  // OSV needs filesystem — skip in cloud MVP, return empty
  try {
    await execAsync(`${osvPath} --version`, { timeout: 5000 });
    // Would need temp dir clone for full scan — placeholder for MVP
    return [];
  } catch {
    return [];
  }
}

function heuristicVulnScan(texts: { name: string; content: string }[]): Vulnerability[] {
  const vulns: Vulnerability[] = [];
  for (const { name, content } of texts) {
    if (/eval\s*\(|exec\s*\(|subprocess\.call/i.test(content)) {
      vulns.push({
        id: `heuristic-${name}`,
        severity: "MEDIUM",
        summary: `Dynamic code execution pattern in ${name}`,
        source: "heuristic",
      });
    }
  }
  return vulns;
}

function calculateRiskScore(factors: {
  suspiciousCount: number;
  vulnCount: number;
  installScriptCount: number;
  networkCount: number;
  lastCommitDays: number | null;
  openIssues: number;
}): number {
  let score = 0;
  score += Math.min(factors.suspiciousCount * 12, 36);
  score += Math.min(factors.vulnCount * 5, 25);
  score += Math.min(factors.installScriptCount * 8, 16);
  score += Math.min(factors.networkCount * 3, 12);
  if (factors.lastCommitDays !== null && factors.lastCommitDays > 365) score += 5;
  if (factors.openIssues > 50) score += 3;
  return Math.min(score, 100);
}

function scoreToLevel(score: number): ScanResult["riskLevel"] {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function scanMetadataOnly(
  metadata: ProjectMetadata,
  techStack: string[],
  source: ProjectSource
): ScanResult {
  const readme = metadata.readme ?? "";
  const suspiciousFiles: string[] = [];
  const installScripts: string[] = [];
  const networkCalls: string[] = [];

  for (const { pattern, label } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(readme)) suspiciousFiles.push(`README: ${label}`);
  }

  if (source === "DOCKER_HUB") {
    installScripts.push(`docker pull ${metadata.fullName}`);
  }

  const lastCommitDays = metadata.lastCommit
    ? Math.floor((Date.now() - new Date(metadata.lastCommit).getTime()) / 86400000)
    : null;

  const riskScore = calculateRiskScore({
    suspiciousCount: suspiciousFiles.length,
    vulnCount: 0,
    installScriptCount: installScripts.length,
    networkCount: networkCalls.length,
    lastCommitDays,
    openIssues: metadata.openIssues,
  });

  return {
    riskScore,
    riskLevel: scoreToLevel(riskScore),
    detectedStack: techStack,
    dependencyFiles: [],
    suspiciousFiles,
    vulnerabilities: [],
    installScripts,
    networkCalls,
    licenseInfo: metadata.license,
    openIssues: metadata.openIssues,
    lastCommitDays,
    scanLog: `[scan] Metadata-only scan for ${source} (${metadata.fullName})`,
    rawReport: { source, metadataOnly: true },
  };
}
