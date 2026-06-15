"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { QueueProcessor } from "@/components/queue-processor";
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink, Play, Download } from "lucide-react";
import { STAGE_LABELS } from "@/lib/pipeline/constants";

interface Job {
  id: string;
  url: string;
  status: string;
  projectId: string | null;
  error: string | null;
  source: string;
  stage: string | null;
  pipelineLog: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function QueuePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [counts, setCounts] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setJobs(data.jobs);
    setCounts(data.counts);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  async function processAll() {
    await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process-all" }),
    });
    load();
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle className="w-4 h-4 text-accent" />;
      case "FAILED": return <XCircle className="w-4 h-4 text-red-400" />;
      case "PROCESSING": return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
      default: return <Clock className="w-4 h-4 text-muted" />;
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Processing Queue</h2>
              <p className="text-sm text-muted">
                Import → scan → sandbox test → analyze → content. View logs on each project page.
              </p>
            </div>
            {counts.pending > 0 && (
              <button
                onClick={processAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dim text-sm"
              >
                <Play className="w-4 h-4" />
                Process All ({counts.pending})
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Pending", value: counts.pending, color: "text-amber-400" },
              { label: "Processing", value: counts.processing, color: "text-blue-400" },
              { label: "Completed", value: counts.completed, color: "text-accent" },
              { label: "Failed", value: counts.failed, color: "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <p>Queue is empty.</p>
              <Link href="/discover" className="text-accent hover:underline text-sm mt-2 inline-block">
                Go to Discover →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const log: { stage: string; message: string }[] = job.pipelineLog
                  ? JSON.parse(job.pipelineLog).slice(-2)
                  : [];
                const stageLabel =
                  job.stage && job.stage in STAGE_LABELS
                    ? STAGE_LABELS[job.stage as keyof typeof STAGE_LABELS]
                    : job.stage;
                return (
                <div key={job.id} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                  {statusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{job.url}</p>
                    <p className="text-xs text-muted">
                      {job.source} · {new Date(job.createdAt).toLocaleTimeString()}
                      {job.status === "PROCESSING" && stageLabel && (
                        <span className="text-accent ml-2">· {stageLabel}</span>
                      )}
                      {job.error && <span className="text-red-400 ml-2">{job.error}</span>}
                    </p>
                    {log.length > 0 && (
                      <p className="text-[10px] text-muted mt-1 truncate">
                        {log.map((e) => `${e.stage}: ${e.message}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  {job.projectId && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Link
                        href={`/projects/${job.projectId}`}
                        className="flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Results
                      </Link>
                      {job.status === "COMPLETED" && (
                        <a
                          href={`/api/projects/${job.projectId}/research-pdf`}
                          download
                          title="Download comprehensive research PDF for NotebookLM"
                          className="flex items-center gap-1 text-xs text-muted hover:text-accent"
                        >
                          <Download className="w-3 h-3" />
                          Research PDF
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}
        </div>
      <QueueProcessor />
    </AppShell>
  );
}
