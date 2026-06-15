"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { STAGE_LABELS } from "@/lib/pipeline/constants";

interface JobCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface ActiveJob {
  stage?: string | null;
  pipelineLog?: string | null;
}

export function QueueProcessor({ autoStart = true }: { autoStart?: boolean }) {
  const router = useRouter();
  const [counts, setCounts] = useState<JobCounts>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [processing, setProcessing] = useState(false);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [lastResult, setLastResult] = useState<{ projectId?: string; error?: string; stage?: string } | null>(null);
  const processingRef = useRef(false);

  async function fetchCounts() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setCounts(data.counts);
    const running = data.jobs?.find((j: { status: string }) => j.status === "PROCESSING");
    if (running) {
      setActiveJob({ stage: running.stage, pipelineLog: running.pipelineLog });
    } else {
      setActiveJob(null);
    }
    return data.counts as JobCounts;
  }

  async function processOne() {
    if (processingRef.current) return null;
    processingRef.current = true;
    setProcessing(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });
      const result = await res.json();
      setLastResult(result);
      await fetchCounts();
      if (result.projectId && !result.error) {
        router.push(`/projects/${result.projectId}`);
      }
      return result;
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }

  useEffect(() => {
    fetchCounts();
    if (!autoStart) return;

    const interval = setInterval(async () => {
      const c = await fetchCounts();
      if (c.pending > 0 && !processingRef.current) {
        if (processingRef.current) return;
        processingRef.current = true;
        setProcessing(true);
        try {
          const res = await fetch("/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "process" }),
          });
          const result = await res.json();
          setLastResult(result);
          await fetchCounts();
          if (result.projectId && !result.error) {
            router.push(`/projects/${result.projectId}`);
          }
        } finally {
          processingRef.current = false;
          setProcessing(false);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [autoStart, router]);

  if (counts.pending === 0 && counts.processing === 0 && !lastResult) return null;

  const pipelineLog: { stage: string; message: string }[] = activeJob?.pipelineLog
    ? JSON.parse(activeJob.pipelineLog).slice(-4)
    : [];

  const stageLabel =
    activeJob?.stage && activeJob.stage in STAGE_LABELS
      ? STAGE_LABELS[activeJob.stage as keyof typeof STAGE_LABELS]
      : activeJob?.stage;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 p-4 rounded-xl bg-card border border-border shadow-2xl">
      <div className="flex items-center gap-2 mb-3">
        {processing ? (
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
        ) : (
          <Clock className="w-4 h-4 text-accent" />
        )}
        <span className="text-sm font-medium">Review Pipeline</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="p-2 rounded bg-background">
          <span className="text-muted">Pending</span>
          <p className="text-lg font-bold text-amber-400">{counts.pending}</p>
        </div>
        <div className="p-2 rounded bg-background">
          <span className="text-muted">Done</span>
          <p className="text-lg font-bold text-accent">{counts.completed}</p>
        </div>
      </div>
      {stageLabel && processing && (
        <p className="text-xs text-accent mb-2">Running: {stageLabel}</p>
      )}
      {pipelineLog.length > 0 && (
        <div className="mb-3 max-h-24 overflow-y-auto text-[10px] text-muted space-y-1 border-t border-border pt-2">
          {pipelineLog.map((entry, i) => (
            <p key={i}>
              <span className="text-accent">{entry.stage}</span> — {entry.message}
            </p>
          ))}
        </div>
      )}
      {lastResult && (
        <div className={`text-xs flex items-center gap-1 ${lastResult.error ? "text-red-400" : "text-accent"}`}>
          {lastResult.error ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
          {lastResult.error ?? "Review complete — opening project"}
        </div>
      )}
      {lastResult?.projectId && !lastResult.error && (
        <a
          href={`/projects/${lastResult.projectId}`}
          className="mt-2 flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> View test results
        </a>
      )}
    </div>
  );
}
