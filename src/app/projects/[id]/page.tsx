import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { StatusBadge, RiskBadge, ScoreRing } from "@/components/badges";
import { StatusSelect } from "@/components/status-select";
import { NotesPanel } from "@/components/notes-panel";
import { CopyBlock } from "@/components/copy-block";
import { ReviewPipelinePanel } from "@/components/review-pipeline-panel";
import { ResearchExportButton } from "@/components/research-export-button";
import { formatDate, formatRelative } from "@/lib/utils";
import { sourceLabel } from "@/lib/importer/detect-source";
import { WORKFLOW_STEPS, STATUS_CONFIG } from "@/lib/constants";
import {
  ArrowLeft,
  Star,
  ExternalLink,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Terminal,
  FileText,
  Video,
  Mic,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      scan: true,
      sandbox: true,
      scorecard: true,
      content: true,
      notes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) notFound();

  const techStack: string[] = project.techStack ? JSON.parse(project.techStack) : [];
  const pros: string[] = project.scorecard?.pros ? JSON.parse(project.scorecard.pros) : [];
  const cons: string[] = project.scorecard?.cons ? JSON.parse(project.scorecard.cons) : [];
  const setupSteps: string[] = project.scorecard?.setupSteps ? JSON.parse(project.scorecard.setupSteps) : [];
  const suspicious: string[] = project.scan?.suspiciousFiles ? JSON.parse(project.scan.suspiciousFiles) : [];
  const vulnerabilities = project.scan?.vulnerabilities ? JSON.parse(project.scan.vulnerabilities) : [];
  const hashtags: string[] = project.content?.hashtags ? JSON.parse(project.content.hashtags) : [];
  const dependencyFiles: string[] = project.scan?.dependencyFiles ? JSON.parse(project.scan.dependencyFiles) : [];
  const smokeTest = project.sandbox?.smokeTest ? JSON.parse(project.sandbox.smokeTest) : null;
  const e2bConfigured = Boolean(process.env.E2B_API_KEY);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-4 lg:p-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          {/* Header */}
          <header className="mb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold">{project.name}</h1>
                  <StatusBadge status={project.status} />
                </div>
                <p className="text-muted mb-3">{project.description}</p>
                <div className="flex items-center gap-4 text-sm text-muted flex-wrap">
                  <span>{sourceLabel(project.source)}</span>
                  {project.owner && <span>@{project.owner}</span>}
                  {project.stars != null && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-warning" />
                      {project.stars.toLocaleString()}
                    </span>
                  )}
                  {project.language && <span>{project.language}</span>}
                  {project.license && <span>{project.license}</span>}
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-accent hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open repo
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap justify-end">
                {project.scorecard?.overallScore != null && (
                  <ScoreRing score={project.scorecard.overallScore} size={64} />
                )}
                {(project.scan || project.scorecard) && (
                  <ResearchExportButton projectId={project.id} projectName={project.name} />
                )}
                {project.content && (
                  <Link
                    href={`/studio/${project.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-dim"
                  >
                    <Mic className="w-4 h-4" />
                    Production Studio
                  </Link>
                )}
                <StatusSelect projectId={project.id} currentStatus={project.status} />
              </div>
            </div>

            {/* Workflow progress */}
            <div className="mt-6 flex flex-wrap gap-1">
              {WORKFLOW_STEPS.map((step) => {
                const stepIndex = WORKFLOW_STEPS.indexOf(step);
                const currentIndex = WORKFLOW_STEPS.indexOf(
                  WORKFLOW_STEPS.includes(project.status) ? project.status : "FOUND"
                );
                const done = stepIndex <= currentIndex;
                return (
                  <div
                    key={step}
                    className={`px-2 py-1 rounded text-xs ${
                      done ? "bg-accent/20 text-accent" : "bg-card text-muted"
                    }`}
                    title={STATUS_CONFIG[step].description}
                  >
                    {STATUS_CONFIG[step].label}
                  </div>
                );
              })}
            </div>
          </header>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ReviewPipelinePanel
                projectId={project.id}
                projectStatus={project.status}
                hasScan={Boolean(project.scan)}
                hasSandbox={Boolean(project.sandbox)}
                hasScorecard={Boolean(project.scorecard)}
                hasContent={Boolean(project.content)}
                e2bConfigured={e2bConfigured}
                scan={
                  project.scan
                    ? {
                        riskLevel: project.scan.riskLevel,
                        riskScore: project.scan.riskScore,
                        dependencyFiles,
                        suspiciousCount: suspicious.length,
                        vulnCount: vulnerabilities.length,
                        scanLog: project.scan.scanLog,
                      }
                    : undefined
                }
                sandbox={
                  project.sandbox
                    ? {
                        provider: project.sandbox.provider,
                        status: project.sandbox.status,
                        verdict: project.sandbox.verdict,
                        installCommand: project.sandbox.installCommand,
                        runCommand: project.sandbox.runCommand,
                        smokeTest,
                        errors: project.sandbox.errors,
                        logs: project.sandbox.logs,
                        durationMs: project.sandbox.durationMs,
                      }
                    : undefined
                }
              />

              {/* Scorecard */}
              {project.scorecard && (
                <Section title="Project Review Scorecard" icon={FileText}>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <Metric label="Overall Score" value={`${project.scorecard.overallScore}/100`} />
                    <Metric label="Video Worthiness" value={`${project.scorecard.videoWorthiness}/100`} />
                    <Metric label="Usefulness" value={`${project.scorecard.usefulnessScore}/100`} />
                    <Metric label="Install Difficulty" value={`${project.scorecard.installDifficulty}/10`} />
                  </div>
                  <Field label="What it does" value={project.scorecard.whatItDoes} />
                  <Field label="Problem solved" value={project.scorecard.problemSolved} />
                  <Field label="Recommendation" value={project.scorecard.recommendation} highlight />
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <ListField label="Pros" items={pros} positive />
                    <ListField label="Cons" items={cons} />
                  </div>
                  {setupSteps.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-muted mb-2">Setup Steps</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        {setupSteps.map((s, i) => (
                          <li key={i} className="text-foreground">{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </Section>
              )}

              {/* Scan results */}
              {project.scan && (
                <Section title="Pre-run Scan" icon={Shield}>
                  <div className="flex items-center gap-3 mb-4">
                    <RiskBadge level={project.scan.riskLevel} score={project.scan.riskScore} />
                    {project.scan.openIssues != null && (
                      <span className="text-sm text-muted">{project.scan.openIssues} open issues</span>
                    )}
                    {project.scan.lastCommitDays != null && (
                      <span className="text-sm text-muted">Last commit {project.scan.lastCommitDays}d ago</span>
                    )}
                  </div>
                  {techStack.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {techStack.map((t) => (
                        <span key={t} className="px-2 py-1 rounded-md bg-background border border-border text-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {suspicious.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2 text-amber-400 text-sm font-medium mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        Suspicious patterns ({suspicious.length})
                      </div>
                      <ul className="text-xs text-muted space-y-1">
                        {suspicious.map((s, i) => (
                          <li key={i}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {vulnerabilities.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-muted mb-2">
                        Vulnerabilities ({vulnerabilities.length})
                      </h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                        {vulnerabilities.slice(0, 10).map((v: { id: string; severity: string; summary: string }, i: number) => (
                          <div key={i} className="text-xs p-2 rounded bg-background border border-border">
                            <span className="text-red-400">{v.severity}</span> — {v.summary}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Sandbox logs */}
              {project.sandbox && (
                <Section title="Sandbox Execution Logs" icon={Terminal}>
                  <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
                    <span className="text-muted">
                      Provider: <span className="text-foreground">{project.sandbox.provider}</span>
                    </span>
                    <span className="text-muted">
                      Verdict:{" "}
                      <span
                        className={
                          project.sandbox.verdict === "failed" || project.sandbox.status === "failed"
                            ? "text-red-400"
                            : project.sandbox.verdict === "simulated"
                              ? "text-amber-400"
                              : "text-emerald-400"
                        }
                      >
                        {project.sandbox.verdict ?? project.sandbox.status}
                      </span>
                    </span>
                    {project.sandbox.durationMs && (
                      <span className="text-muted">{(project.sandbox.durationMs / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  {project.sandbox.runCommand && (
                    <div className="mb-3 font-mono text-xs p-2 rounded bg-background border border-border">
                      run: {project.sandbox.runCommand}
                    </div>
                  )}
                  <div className="flex gap-4 mb-4 flex-wrap">
                    <ResultPill
                      ok={project.sandbox.verdict === "passed"}
                      label={`Install ${project.sandbox.verdict === "simulated" ? "(simulated)" : ""}`}
                    />
                    {smokeTest && (
                      <ResultPill
                        ok={!smokeTest.skipped && smokeTest.exitCode === 0}
                        label={smokeTest.skipped ? "Smoke (skipped)" : "Smoke test"}
                      />
                    )}
                  </div>
                  {project.sandbox.logs && <CopyBlock label="Execution Logs" content={project.sandbox.logs} />}
                  {project.sandbox.errors && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {project.sandbox.errors}
                    </div>
                  )}
                </Section>
              )}

              {/* Content output */}
              {project.content && (
                <Section title="Content Engine" icon={Video}>
                  <Field label="YouTube Title" value={project.content.youtubeTitle} />
                  <Field label="Hook" value={project.content.hook} />
                  <Field label="Thumbnail Idea" value={project.content.thumbnailIdea} />
                  {project.content.script5min && (
                    <CopyBlock label="5-Minute Script" content={project.content.script5min} />
                  )}
                  {project.content.script10min && (
                    <div className="mt-4">
                      <CopyBlock label="10-Minute Script" content={project.content.script10min} />
                    </div>
                  )}
                  {project.content.shortsScript && (
                    <div className="mt-4">
                      <CopyBlock label="Shorts/Reels Script" content={project.content.shortsScript} />
                    </div>
                  )}
                  {project.content.linkedinPost && (
                    <div className="mt-4">
                      <CopyBlock label="LinkedIn Post" content={project.content.linkedinPost} />
                    </div>
                  )}
                  {hashtags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {hashtags.map((tag) => (
                        <span key={tag} className="text-xs text-accent">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Section title="Manual Notes" icon={FileText}>
                <NotesPanel
                  projectId={project.id}
                  initialNotes={project.notes.map((n) => ({
                    ...n,
                    createdAt: n.createdAt.toISOString(),
                  }))}
                />
              </Section>

              <div className="p-4 rounded-xl bg-card border border-border text-sm space-y-2">
                <h4 className="font-medium">Metadata</h4>
                <div className="text-muted space-y-1 text-xs">
                  <p>Created: {formatDate(project.createdAt)}</p>
                  <p>Updated: {formatRelative(project.updatedAt)}</p>
                  {project.lastCommit && <p>Last commit: {formatDate(project.lastCommit)}</p>}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-muted">
                <p className="text-accent font-medium mb-1">Safety Policy Active</p>
                <p>No Mac files accessed. No personal credentials. Sandbox auto-destroyed after test.</p>
              </div>
            </div>
          </div>
        </div>
    </AppShell>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="p-5 rounded-xl bg-card border border-border">
      <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
        <Icon className="w-5 h-5 text-accent" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-background border border-border">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="mb-3">
      <h4 className="text-sm font-medium text-muted mb-1">{label}</h4>
      <p className={`text-sm ${highlight ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function ListField({ label, items, positive }: { label: string; items: string[]; positive?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-muted mb-2">{label}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex items-start gap-2 ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {positive ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
        ok ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
      }`}
    >
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}
