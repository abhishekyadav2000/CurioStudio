"use client";

import { useState } from "react";
import {
  Shield,
  Package,
  Terminal,
  Brain,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewCriterion {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "pass" | "fail" | "warn" | "pending" | "simulated";
  detail?: string;
}

interface PipelineStage {
  id: string;
  label: string;
  done: boolean;
  active?: boolean;
  failed?: boolean;
}

interface ReviewPipelinePanelProps {
  projectId: string;
  projectStatus: string;
  hasScan: boolean;
  hasSandbox: boolean;
  hasScorecard: boolean;
  hasContent: boolean;
  scan?: {
    riskLevel: string;
    riskScore: number;
    dependencyFiles?: string[];
    suspiciousCount: number;
    vulnCount: number;
    scanLog?: string | null;
  };
  sandbox?: {
    provider: string;
    status: string;
    verdict?: string | null;
    installCommand?: string | null;
    runCommand?: string | null;
    smokeTest?: { command: string; exitCode: number | null; output: string; skipped: boolean } | null;
    errors?: string | null;
    logs?: string | null;
    durationMs?: number | null;
  };
  e2bConfigured?: boolean;
}

export function ReviewPipelinePanel({
  projectId,
  projectStatus,
  hasScan,
  hasSandbox,
  hasScorecard,
  hasContent,
  scan,
  sandbox,
  e2bConfigured = false,
}: ReviewPipelinePanelProps) {
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const stages: PipelineStage[] = [
    { id: "import", label: "Import", done: true },
    { id: "scan", label: "Scan", done: hasScan, failed: projectStatus === "FOUND" && !hasScan },
    {
      id: "sandbox",
      label: "Sandbox",
      done: hasSandbox,
      failed: sandbox?.status === "failed",
    },
    { id: "analyze", label: "Analyze", done: hasScorecard },
    { id: "content", label: "Content", done: hasContent },
  ];

  const criteria: ReviewCriterion[] = [
    {
      id: "security",
      label: "Security scan",
      description: "Heuristic patterns, dependency files, optional Trivy",
      icon: Shield,
      status: !scan
        ? "pending"
        : scan.riskLevel === "critical" || scan.riskLevel === "high"
          ? "fail"
          : scan.suspiciousCount > 0
            ? "warn"
            : "pass",
      detail: scan
        ? `${scan.riskLevel} risk (${scan.riskScore}/100), ${scan.suspiciousCount} flags, ${scan.vulnCount} vulns`
        : undefined,
    },
    {
      id: "deps",
      label: "Dependency check",
      description: "Lockfiles and manifest detection",
      icon: Package,
      status: !scan ? "pending" : (scan.dependencyFiles?.length ?? 0) > 0 ? "pass" : "warn",
      detail: scan?.dependencyFiles?.length
        ? scan.dependencyFiles.join(", ")
        : "No dependency files detected at repo root",
    },
    {
      id: "runnable",
      label: "Runnable demo",
      description: e2bConfigured ? "E2B clone → install → smoke test" : "Simulation preview only",
      icon: Terminal,
      status: !sandbox
        ? "pending"
        : sandbox.verdict === "passed"
          ? "pass"
          : sandbox.verdict === "failed"
            ? "fail"
            : sandbox.verdict === "simulated"
              ? "simulated"
              : sandbox.status === "failed"
                ? "fail"
                : "warn",
      detail: sandbox
        ? `${sandbox.provider} · ${sandbox.verdict ?? sandbox.status}${sandbox.durationMs ? ` · ${(sandbox.durationMs / 1000).toFixed(1)}s` : ""}`
        : undefined,
    },
    {
      id: "analysis",
      label: "LLM analysis",
      description: "Scorecard, pros/cons, recommendation",
      icon: Brain,
      status: hasScorecard ? "pass" : "pending",
    },
    {
      id: "content",
      label: "Content engine",
      description: "Scripts, hooks, social copy",
      icon: FileText,
      status: hasContent ? "pass" : "pending",
    },
  ];

  async function runTest() {
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/test-run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test run failed");
      window.location.reload();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test run failed");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="p-5 rounded-xl bg-card border border-border space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Safe Review Pipeline
          </h3>
          <p className="text-sm text-muted mt-1">
            {e2bConfigured
              ? "E2B sandbox enabled — tests run in isolated remote environments."
              : "Simulation mode — scans are real; install/run steps are preview-only until E2B_API_KEY is set."}
          </p>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={testing || !hasScan}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dim disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Re-run Safe Test
        </button>
      </div>

      {testError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{testError}</div>
      )}

      {/* Pipeline stages */}
      <div className="flex flex-wrap gap-2">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-2">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border",
                stage.failed
                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                  : stage.done
                    ? "bg-accent/10 text-accent border-accent/30"
                    : "bg-background text-muted border-border"
              )}
            >
              {stage.label}
            </span>
            {i < stages.length - 1 && <span className="text-muted text-xs">→</span>}
          </div>
        ))}
      </div>

      {/* Review criteria */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {criteria.map((c) => (
          <CriterionCard key={c.id} {...c} />
        ))}
      </div>

      {/* Sandbox verdict banner */}
      {sandbox && (
        <VerdictBanner sandbox={sandbox} e2bConfigured={e2bConfigured} />
      )}

      {scan?.scanLog && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted hover:text-foreground">Scan log</summary>
          <pre className="mt-2 p-3 rounded-lg bg-background border border-border overflow-x-auto whitespace-pre-wrap max-h-40">
            {scan.scanLog}
          </pre>
        </details>
      )}
    </section>
  );
}

function CriterionCard({
  label,
  description,
  icon: Icon,
  status,
  detail,
}: ReviewCriterion) {
  const statusIcon =
    status === "pass" ? (
      <CheckCircle className="w-4 h-4 text-emerald-400" />
    ) : status === "fail" ? (
      <XCircle className="w-4 h-4 text-red-400" />
    ) : status === "simulated" ? (
      <AlertTriangle className="w-4 h-4 text-amber-400" />
    ) : status === "warn" ? (
      <AlertTriangle className="w-4 h-4 text-amber-400" />
    ) : (
      <span className="w-4 h-4 rounded-full border border-muted" />
    );

  return (
    <div className="p-3 rounded-lg bg-background border border-border">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-accent shrink-0" />
        <span className="text-sm font-medium">{label}</span>
        {statusIcon}
      </div>
      <p className="text-[11px] text-muted">{description}</p>
      {detail && <p className="text-[11px] mt-1 text-foreground/80">{detail}</p>}
    </div>
  );
}

function VerdictBanner({
  sandbox,
  e2bConfigured,
}: {
  sandbox: NonNullable<ReviewPipelinePanelProps["sandbox"]>;
  e2bConfigured: boolean;
}) {
  const verdict = sandbox.verdict ?? sandbox.status;
  const isPass = verdict === "passed";
  const isSim = verdict === "simulated" || sandbox.status === "simulated";
  const isFail = verdict === "failed" || sandbox.status === "failed";

  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        isPass && "bg-emerald-500/10 border-emerald-500/30",
        isSim && "bg-amber-500/10 border-amber-500/30",
        isFail && "bg-red-500/10 border-red-500/30",
        !isPass && !isSim && !isFail && "bg-background border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {isPass && <CheckCircle className="w-5 h-5 text-emerald-400" />}
        {isSim && <AlertTriangle className="w-5 h-5 text-amber-400" />}
        {isFail && <XCircle className="w-5 h-5 text-red-400" />}
        <span className="font-semibold">
          Test verdict: {verdict.toUpperCase()}
        </span>
      </div>
      {isSim && (
        <p className="text-sm text-muted">
          No code was executed. Add <code className="text-accent">E2B_API_KEY</code> in Settings for real isolated
          testing. Security scan results above are still valid.
        </p>
      )}
      {sandbox.installCommand && (
        <p className="text-xs font-mono mt-2 text-muted">$ {sandbox.installCommand}</p>
      )}
      {sandbox.smokeTest && !sandbox.smokeTest.skipped && (
        <p className="text-xs mt-1 text-muted">
          Smoke: exit {sandbox.smokeTest.exitCode} — {sandbox.smokeTest.output.slice(0, 120)}
        </p>
      )}
      {sandbox.errors && (
        <p className="text-xs mt-2 text-red-400">{sandbox.errors}</p>
      )}
      {!e2bConfigured && isSim && (
        <p className="text-xs mt-2 text-amber-400/90">
          Honest mode: simulated runs never report fake success.
        </p>
      )}
    </div>
  );
}
