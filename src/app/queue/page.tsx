"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { QueueProcessor } from "@/components/queue-processor";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Play,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
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
  const [deleting, setDeleting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showBulk, setShowBulk] = useState(false);

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

  async function deleteJobs(mode: "completed" | "all") {
    const label =
      mode === "completed"
        ? `Delete all ${counts.completed} completed job(s)?`
        : `Delete all ${counts.pending + counts.processing + counts.completed + counts.failed} job(s)?`;
    if (!confirm(`${label} This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const query = mode === "all" ? "?all=true" : "?status=COMPLETED";
      const res = await fetch(`/api/jobs${query}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  async function toggleComplete(job: Job, checked: boolean) {
    if (job.status === "PROCESSING") return;

    setUpdating(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: checked ? "COMPLETED" : "PENDING" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");

      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: data.job.status, completedAt: data.job.completedAt } : j
        )
      );
      setCounts((prev) => {
        const next = { ...prev };
        const wasCompleted = job.status === "COMPLETED";
        const nowCompleted = checked;
        if (wasCompleted && !nowCompleted) {
          next.completed = Math.max(0, next.completed - 1);
          next.pending += 1;
        } else if (!wasCompleted && nowCompleted) {
          if (job.status === "PENDING") next.pending = Math.max(0, next.pending - 1);
          if (job.status === "FAILED") next.failed = Math.max(0, next.failed - 1);
          next.completed += 1;
        }
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(null);
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-4 h-4 text-accent" />;
      case "FAILED":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "PROCESSING":
        return <Loader2 className="w-4 h-4 animate-spin text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-muted" />;
    }
  };

  const totalJobs = counts.pending + counts.processing + counts.completed + counts.failed;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Queue</h2>
            <p className="text-sm text-muted mt-1">
              Pipeline: scan → sandbox → analyze → content. When done, open{" "}
              <strong className="text-foreground">Results</strong> → Export Research PDF.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {counts.pending > 0 && (
              <button
                onClick={processAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dim text-sm"
              >
                <Play className="w-4 h-4" />
                Process All ({counts.pending})
              </button>
            )}
            {totalJobs > 0 && (
              <button
                onClick={() => setShowBulk((s) => !s)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm text-muted hover:text-foreground hover:bg-card-hover"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {showBulk && totalJobs > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-card border border-border flex gap-2 flex-wrap text-sm">
            {counts.completed > 0 && (
              <button
                onClick={() => deleteJobs("completed")}
                disabled={deleting}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-border text-muted hover:text-foreground disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Clear completed ({counts.completed})
              </button>
            )}
            <button
              onClick={() => deleteJobs("all")}
              disabled={deleting}
              className="flex items-center gap-1 px-3 py-1.5 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Delete all
            </button>
          </div>
        )}

        <div className="flex gap-4 mb-4 text-sm">
          {[
            { label: "Pending", value: counts.pending, color: "text-amber-400" },
            { label: "Processing", value: counts.processing, color: "text-blue-400" },
            { label: "Done", value: counts.completed, color: "text-accent" },
            { label: "Failed", value: counts.failed, color: "text-red-400" },
          ].map((s) => (
            <span key={s.label} className="text-muted">
              {s.label}: <strong className={s.color}>{s.value}</strong>
            </span>
          ))}
        </div>

        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p>Queue is empty.</p>
            <Link href="/discover" className="text-accent hover:underline text-sm mt-2 inline-block">
              Discover & Queue Top 5 →
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
              const isProcessing = job.status === "PROCESSING";
              const isCompleted = job.status === "COMPLETED";

              return (
                <div
                  key={job.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                >
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    disabled={isProcessing || updating === job.id}
                    onChange={(e) => toggleComplete(job, e.target.checked)}
                    className="rounded accent-accent shrink-0 disabled:opacity-40"
                    title={isProcessing ? "Processing…" : isCompleted ? "Mark pending" : "Mark complete"}
                  />
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
                      <p className="text-[10px] text-muted mt-0.5 truncate">
                        {log.map((e) => `${e.stage}: ${e.message}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  {updating === job.id && (
                    <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                  )}
                  {job.projectId && (
                    <Link
                      href={`/projects/${job.projectId}`}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Results
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <QueueProcessor />
    </AppShell>
  );
}
