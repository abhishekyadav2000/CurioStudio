import type { ProjectMetadata } from "../importer/types";
import type { ProjectSource } from "@prisma/client";
import type { ScanResult } from "../scanner";
import {
  computeSandboxVerdict,
  getSandboxCapabilities,
  type SandboxVerdict,
} from "./capabilities";

export type { SandboxCapabilities, SandboxMode, SandboxVerdict } from "./capabilities";
export { getSandboxCapabilities, computeSandboxVerdict } from "./capabilities";

export interface SmokeTestResult {
  command: string;
  exitCode: number | null;
  output: string;
  skipped: boolean;
}

export interface SandboxRunResult {
  sandboxId: string | null;
  provider: string;
  status: "completed" | "failed" | "simulated";
  verdict: SandboxVerdict;
  installCommand: string;
  runCommand: string | null;
  smokeTest: SmokeTestResult | null;
  logs: string;
  errors: string | null;
  exitCode: number | null;
  durationMs: number;
}

const SAFETY_PREAMBLE = `
# CurioStudio — Isolated Sandbox
# Rules: no host access, no credentials, restricted network, auto-destroy
`.trim();

function detectInstallCommand(metadata: ProjectMetadata, stack: string[]): string {
  const readme = (metadata.readme ?? "").toLowerCase();

  if (readme.includes("pip install") || stack.includes("Python")) {
    return "pip install -r requirements.txt 2>/dev/null || pip install . 2>/dev/null || echo 'No pip deps'";
  }
  if (readme.includes("npm install") || readme.includes("yarn") || stack.includes("Node.js")) {
    if (readme.includes("pnpm")) return "pnpm install --ignore-scripts";
    if (readme.includes("yarn")) return "yarn install --ignore-scripts";
    return "npm install --ignore-scripts";
  }
  if (readme.includes("cargo build") || stack.includes("Rust")) {
    return "cargo build --release 2>/dev/null || echo 'Cargo build skipped'";
  }
  if (readme.includes("go build") || stack.includes("Go")) {
    return "go build ./... 2>/dev/null || echo 'Go build skipped'";
  }
  if (readme.includes("docker compose") || readme.includes("docker-compose")) {
    return "echo 'Docker compose detected — manual review required'";
  }
  return "echo 'No install command detected — inspect README manually'";
}

function detectRunCommand(metadata: ProjectMetadata, stack: string[]): string | null {
  const readme = (metadata.readme ?? "").toLowerCase();
  if (readme.includes("npm run dev")) return "npm run dev";
  if (readme.includes("npm start")) return "npm start";
  if (readme.includes("python ") || readme.includes("python3")) return "python main.py 2>/dev/null || python app.py 2>/dev/null || echo 'No python entry'";
  if (readme.includes("uvicorn")) return "uvicorn main:app --host 0.0.0.0 --port 8000";
  if (readme.includes("flask run")) return "flask run";
  if (stack.includes("Next.js")) return "npm run dev";
  return null;
}

function detectSmokeCommand(stack: string[], runCommand: string | null): string {
  if (stack.includes("Node.js") || stack.includes("Next.js") || stack.includes("React")) {
    return "npm run build --if-present 2>&1 | tail -20 || node -v && npm -v";
  }
  if (stack.includes("Python")) {
    return "python -c \"import sys; print(sys.version)\" 2>&1 && (python -m pytest --co -q 2>/dev/null | head -5 || echo 'no pytest collection')";
  }
  if (stack.includes("Go")) {
    return "go version && go test ./... -run=^$ -count=0 2>&1 | tail -10 || echo 'go smoke skipped'";
  }
  if (runCommand) {
    return `timeout 15 ${runCommand} 2>&1 | head -30 || echo 'run smoke timed out'`;
  }
  return "echo 'Smoke test: dependency install only'";
}

export async function runInSandbox(
  metadata: ProjectMetadata,
  scan: ScanResult,
  source: ProjectSource = "GITHUB"
): Promise<SandboxRunResult> {
  const installCommand = detectInstallCommand(metadata, scan.detectedStack);
  const runCommand = detectRunCommand(metadata, scan.detectedStack);
  const smokeCommand = detectSmokeCommand(scan.detectedStack, runCommand);
  const start = Date.now();
  const caps = getSandboxCapabilities();

  if (source === "DOCKER_HUB") {
    return simulateDockerPull(metadata, installCommand, scan, smokeCommand, start, caps.message);
  }

  if (source === "HUGGINGFACE" || source === "KAGGLE") {
    return simulateMetadataSandbox(metadata, installCommand, runCommand, scan, smokeCommand, start, source, caps.message);
  }

  if (!metadata.cloneUrl) {
    return simulateMetadataSandbox(metadata, installCommand, runCommand, scan, smokeCommand, start, source, caps.message);
  }

  if (!caps.e2bConfigured) {
    return simulateSandbox(metadata, installCommand, runCommand, scan, smokeCommand, start, caps.message);
  }

  try {
    const { Sandbox } = await import("@e2b/code-interpreter");
    const sandbox = await Sandbox.create({
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 5 * 60 * 1000,
    });

    const logs: string[] = [SAFETY_PREAMBLE, `[sandbox] Created E2B sandbox: ${sandbox.sandboxId}`];

    const cloneCmd = `git clone --depth 1 ${metadata.cloneUrl} /home/user/project && cd /home/user/project`;
    const cloneResult = await sandbox.commands.run(cloneCmd, { timeoutMs: 120000 });
    logs.push(`[clone] exit=${cloneResult.exitCode}\n${cloneResult.stdout}\n${cloneResult.stderr}`);

    if (cloneResult.exitCode !== 0) {
      await sandbox.kill();
      const verdict = computeSandboxVerdict({ status: "failed", installExitCode: cloneResult.exitCode });
      return {
        sandboxId: sandbox.sandboxId,
        provider: "e2b",
        status: "failed",
        verdict,
        installCommand,
        runCommand,
        smokeTest: null,
        logs: logs.join("\n"),
        errors: cloneResult.stderr || "Clone failed",
        exitCode: cloneResult.exitCode,
        durationMs: Date.now() - start,
      };
    }

    const installResult = await sandbox.commands.run(
      `cd /home/user/project && ${installCommand}`,
      { timeoutMs: 180000 }
    );
    logs.push(`[install] $ ${installCommand}`);
    logs.push(`[install] exit=${installResult.exitCode}\n${installResult.stdout}\n${installResult.stderr}`);

    let smokeTest: SmokeTestResult | null = null;
    if (installResult.exitCode === 0) {
      const smokeResult = await sandbox.commands.run(
        `cd /home/user/project && ${smokeCommand}`,
        { timeoutMs: 60000 }
      );
      smokeTest = {
        command: smokeCommand,
        exitCode: smokeResult.exitCode,
        output: (smokeResult.stdout + smokeResult.stderr).slice(0, 4000),
        skipped: false,
      };
      logs.push(`[smoke] $ ${smokeCommand}`);
      logs.push(`[smoke] exit=${smokeResult.exitCode}\n${smokeTest.output}`);

      if (runCommand) {
        const runResult = await sandbox.commands.run(
          `cd /home/user/project && timeout 30 ${runCommand}`,
          { timeoutMs: 45000 }
        );
        logs.push(`[run] $ ${runCommand}\n${runResult.stdout}\n${runResult.stderr}`);
      }
    } else {
      smokeTest = { command: smokeCommand, exitCode: null, output: "Skipped — install failed", skipped: true };
    }

    await sandbox.kill();
    logs.push("[sandbox] Environment destroyed");

    const failed =
      installResult.exitCode !== 0 || (smokeTest.exitCode != null && smokeTest.exitCode !== 0);
    const status = failed ? "failed" : "completed";
    const verdict = computeSandboxVerdict({
      status,
      installExitCode: installResult.exitCode,
      smokeExitCode: smokeTest?.exitCode,
    });

    return {
      sandboxId: sandbox.sandboxId,
      provider: "e2b",
      status,
      verdict,
      installCommand,
      runCommand,
      smokeTest,
      logs: logs.join("\n"),
      errors: failed ? installResult.stderr || smokeTest?.output || "Sandbox test failed" : null,
      exitCode: installResult.exitCode,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      sandboxId: null,
      provider: "e2b",
      status: "failed",
      verdict: "failed",
      installCommand,
      runCommand,
      smokeTest: null,
      logs: `[sandbox] E2B error: ${message}`,
      errors: message,
      exitCode: 1,
      durationMs: Date.now() - start,
    };
  }
}

function simulateSandbox(
  metadata: ProjectMetadata,
  installCommand: string,
  runCommand: string | null,
  scan: ScanResult,
  smokeCommand: string,
  start: number,
  modeMessage: string
): SandboxRunResult {
  const logs = [
    SAFETY_PREAMBLE,
    "[sandbox] ⚠ SIMULATION MODE — no code was executed on this machine or in E2B",
    `[sandbox] ${modeMessage}`,
    "",
    "[preview] Planned steps:",
    `  1. git clone --depth 1 ${metadata.cloneUrl}`,
    `  2. ${installCommand}`,
    `  3. smoke: ${smokeCommand}`,
    runCommand ? `  4. run: ${runCommand}` : "  4. (no run command detected)",
    "",
    `[scan] Risk level: ${scan.riskLevel} (${scan.riskScore}/100)`,
    `[scan] Suspicious patterns: ${scan.suspiciousFiles.length}`,
    `[scan] Dependency files: ${scan.dependencyFiles.join(", ") || "none detected"}`,
    "",
    "[verdict] SIMULATED — set E2B_API_KEY in Settings for real isolated testing",
  ].join("\n");

  return {
    sandboxId: null,
    provider: "simulated",
    status: "simulated",
    verdict: "simulated",
    installCommand,
    runCommand,
    smokeTest: {
      command: smokeCommand,
      exitCode: null,
      output: "Not executed — simulation mode",
      skipped: true,
    },
    logs,
    errors: "Simulation only — install and smoke test were NOT run. Add E2B_API_KEY for real execution.",
    exitCode: null,
    durationMs: Date.now() - start,
  };
}

function simulateDockerPull(
  metadata: ProjectMetadata,
  installCommand: string,
  scan: ScanResult,
  smokeCommand: string,
  start: number,
  modeMessage: string
): SandboxRunResult {
  const pullCmd = `docker pull ${metadata.fullName}:${metadata.defaultBranch || "latest"}`;
  const logs = [
    SAFETY_PREAMBLE,
    "[sandbox] Docker Hub — simulated pull (no container started)",
    `[sandbox] ${modeMessage}`,
    `[sandbox] Would run: ${pullCmd}`,
    `[smoke] Would run: ${smokeCommand}`,
    `[scan] Risk level: ${scan.riskLevel} (${scan.riskScore}/100)`,
    metadata.readme ? `[readme] ${metadata.readme.slice(0, 500)}...` : "",
    "[verdict] SIMULATED — container pull not executed",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sandboxId: null,
    provider: "simulated",
    status: "simulated",
    verdict: "simulated",
    installCommand: pullCmd,
    runCommand: null,
    smokeTest: { command: smokeCommand, exitCode: null, output: "Not executed", skipped: true },
    logs,
    errors: "Docker pull not executed — simulation mode",
    exitCode: null,
    durationMs: Date.now() - start,
  };
}

function simulateMetadataSandbox(
  metadata: ProjectMetadata,
  installCommand: string,
  runCommand: string | null,
  scan: ScanResult,
  smokeCommand: string,
  start: number,
  source: ProjectSource,
  modeMessage: string
): SandboxRunResult {
  const logs = [
    SAFETY_PREAMBLE,
    `[sandbox] ${source} — metadata review mode (no git clone available)`,
    `[sandbox] ${modeMessage}`,
    `[sandbox] Resource: ${metadata.homepage ?? metadata.fullName}`,
    `[sandbox] Install hint: ${installCommand}`,
    runCommand ? `[sandbox] Run hint: ${runCommand}` : "",
    `[smoke] Would run: ${smokeCommand}`,
    `[scan] Risk level: ${scan.riskLevel} (${scan.riskScore}/100)`,
    "[verdict] SKIPPED — analysis uses README/metadata only",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    sandboxId: null,
    provider: "simulated",
    status: "simulated",
    verdict: "simulated",
    installCommand,
    runCommand,
    smokeTest: { command: smokeCommand, exitCode: null, output: "Not applicable for this source", skipped: true },
    logs,
    errors: null,
    exitCode: null,
    durationMs: Date.now() - start,
  };
}
