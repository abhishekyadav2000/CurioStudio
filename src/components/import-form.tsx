"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { detectSource, isSupportedMvp, sourceLabel } from "@/lib/importer/detect-source";

export function ImportForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const parsed = url.trim() ? detectSource(url) : null;
  const supported = parsed ? isSupportedMvp(parsed) : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (data.project?.id) router.push(`/studio/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
        <div className="relative flex flex-col sm:flex-row gap-3 p-2 bg-card rounded-2xl border border-border">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste GitHub repo URL — e.g. https://github.com/vercel/next.js"
            className="flex-1 bg-transparent px-4 py-3 text-foreground placeholder:text-muted outline-none text-sm sm:text-base"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim() || !supported}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running pipeline…
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Test Safely
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {parsed && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted">Detected:</span>
          <span className="px-2 py-0.5 rounded-md bg-card border border-border text-foreground">
            {sourceLabel(parsed.source)}
          </span>
          {parsed.fullName && (
            <span className="text-muted font-mono text-xs">{parsed.fullName}</span>
          )}
          {!supported && (
            <span className="flex items-center gap-1 text-warning text-xs">
              <AlertTriangle className="w-3 h-3" />
              MVP 1: GitHub only
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-4 p-4 rounded-xl bg-card border border-border animate-slide-up">
          <p className="text-sm text-muted mb-3">Running secure pipeline…</p>
          <div className="space-y-2 text-xs font-mono">
            {["Fetching metadata", "Pre-run scan", "Creating sandbox", "Installing deps", "Analyzing", "Generating script"].map(
              (step, i) => (
                <div key={step} className="flex items-center gap-2 text-muted">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" style={{ animationDelay: `${i * 200}ms` }} />
                  {step}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </form>
  );
}
