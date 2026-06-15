"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Loader2,
  Star,
  CheckSquare,
  Square,
  Zap,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";
import { DiscoverListSkeleton } from "@/components/page-skeleton";
import { SOURCE_LABELS, type TrendingSource } from "@/lib/discovery/types";

interface TrendingEntry {
  id: string;
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  taskType: string | null;
  starsToday: string | null;
  metricLabel: string | null;
  metricValue: string | null;
  rank: number;
  imported: boolean;
  queued: boolean;
  projectId: string | null;
  source: string;
}

const QUEUE_DEBOUNCE_MS = 2000;
const PAGE_SIZE = 20;

const SOURCES: { key: TrendingSource; api: string }[] = [
  { key: "github", api: "GITHUB" },
  { key: "huggingface", api: "HUGGINGFACE" },
  { key: "dockerhub", api: "DOCKER_HUB" },
  { key: "kaggle", api: "KAGGLE" },
  { key: "gitlab", api: "GITLAB" },
  { key: "npm", api: "NPM" },
  { key: "pypi", api: "PYPI" },
  { key: "hackernews", api: "HACKER_NEWS" },
  { key: "awesome", api: "AWESOME" },
];

function isUnavailable(entry: TrendingEntry) {
  return entry.imported || entry.queued;
}

export function DiscoverPage() {
  const [source, setSource] = useState<TrendingSource>("github");
  const [entries, setEntries] = useState<TrendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queuing, setQueuing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [spoken, setSpoken] = useState("en");
  const [language, setLanguage] = useState("");
  const [hfKind, setHfKind] = useState<"spaces" | "models">("spaces");
  const [externalUrl, setExternalUrl] = useState("");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const lastQueueAt = useRef(0);
  const router = useRouter();

  const apiSource = SOURCES.find((s) => s.key === source)?.api ?? "GITHUB";

  function buildQuery(refresh = false) {
    const params = new URLSearchParams({
      source: apiSource.toLowerCase(),
      period,
      spoken,
      language,
      kind: hfKind,
      refresh: String(refresh),
    });
    return params.toString();
  }

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/trending?${buildQuery(refresh)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEntries(data.entries);
      setFetchedAt(data.fetchedAt);
      setExternalUrl(data.externalUrl ?? data.githubUrl ?? "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setSelected(new Set());
    setVisibleCount(PAGE_SIZE);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, period, spoken, language, hfKind]);

  function toggleSelect(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  const guardQueue = useCallback(() => {
    if (queuing) return false;
    const now = Date.now();
    if (now - lastQueueAt.current < QUEUE_DEBOUNCE_MS) return false;
    lastQueueAt.current = now;
    return true;
  }, [queuing]);

  async function queueSelected() {
    if (!guardQueue()) return;
    setQueuing(true);
    try {
      const urls = entries
        .filter((e) => selected.has(e.fullName) && !isUnavailable(e))
        .map((e) => e.url);
      if (!urls.length) return;
      const res = await fetch("/api/trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue", urls, source: apiSource.toLowerCase() }),
      });
      const data = await res.json();
      if (data.queued > 0) router.push("/queue");
      else await load(false);
    } finally {
      setQueuing(false);
    }
  }

  async function queueTop(n: number) {
    if (!guardQueue()) return;
    setQueuing(true);
    try {
      const res = await fetch("/api/trending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "queue",
          count: n,
          source: apiSource.toLowerCase(),
          period,
          spokenLanguage: spoken,
          language,
          kind: hfKind,
        }),
      });
      const data = await res.json();
      if (data.queued > 0) router.push("/queue");
      else await load(false);
    } finally {
      setQueuing(false);
    }
  }

  const sourceLabel = SOURCE_LABELS[apiSource as keyof typeof SOURCE_LABELS] ?? source;
  const visibleEntries = entries.slice(0, visibleCount);
  const hasMore = visibleCount < entries.length;

  return (
    <div className="h-full flex flex-col overflow-hidden max-w-5xl mx-auto p-4 lg:p-6">
      <div className="shrink-0">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Discover" }]} />
      <PageHeader
        title="Discover"
        description="Find trending OSS projects — queue for safe scan + sandbox review"
        helpHref="/help"
        actions={
          <button
            onClick={() => queueTop(5)}
            disabled={queuing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent-dim text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {queuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Queue Top 5
          </button>
        }
      />

      <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-center gap-3 text-sm">
        <ArrowRight className="w-4 h-4 text-accent shrink-0" />
        <span className="text-muted">
          After queuing, go to{" "}
          <a href="/queue" className="text-accent hover:underline font-medium">
            Queue
          </a>{" "}
          to watch scan → sandbox → analyze. Then open Results for Research PDF.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted block mb-1">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as TrendingSource)}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
          >
            {SOURCES.map(({ key, api }) => (
              <option key={key} value={key}>
                {SOURCE_LABELS[api as keyof typeof SOURCE_LABELS]}
              </option>
            ))}
          </select>
        </div>

        {source === "github" && (
          <>
            <div>
              <label className="text-xs text-muted block mb-1">Spoken</label>
              <select value={spoken} onChange={(e) => setSpoken(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
                <option value="en">English</option>
                <option value="">Any</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
                <option value="">Any</option>
                <option value="python">Python</option>
                <option value="typescript">TypeScript</option>
                <option value="rust">Rust</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Period</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value as "daily" | "weekly")} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
                <option value="daily">Today</option>
                <option value="weekly">This week</option>
              </select>
            </div>
          </>
        )}
        {(source === "huggingface" || source === "kaggle") && (
          <div>
            <label className="text-xs text-muted block mb-1">Type</label>
            <select value={hfKind} onChange={(e) => setHfKind(e.target.value as "spaces" | "models")} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
              {source === "huggingface" ? (
                <>
                  <option value="spaces">Spaces</option>
                  <option value="models">Models</option>
                </>
              ) : (
                <>
                  <option value="spaces">Datasets</option>
                  <option value="models">Notebooks</option>
                </>
              )}
            </select>
          </div>
        )}
        <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-card-hover text-sm">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">{sourceLabel} Trending</h2>
          <p className="text-xs text-muted">
            {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleString()}` : "Loading…"}
            {externalUrl && (
              <>
                {" · "}
                <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  View on {sourceLabel} ↗
                </a>
              </>
            )}
          </p>
        </div>
      </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
      {selected.size > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-card border border-border flex items-center justify-between">
          <span className="text-sm text-muted">{selected.size} selected</span>
          <button
            onClick={queueSelected}
            disabled={queuing}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-accent/40 text-accent text-sm hover:bg-accent/10 disabled:opacity-50"
          >
            {queuing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Queue selected
          </button>
        </div>
      )}

      {loading ? (
        <DiscoverListSkeleton />
      ) : entries.length === 0 ? (
        <p className="text-center text-muted py-12">No results — click Refresh to fetch from {sourceLabel}</p>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card/30 max-h-[min(520px,60vh)] overflow-y-auto">
            <div className="space-y-2 p-2">
              {visibleEntries.map((entry) => {
            const unavailable = isUnavailable(entry);
            return (
              <div
                key={entry.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  unavailable
                    ? "bg-card/50 border-border opacity-60"
                    : selected.has(entry.fullName)
                      ? "bg-accent/5 border-accent/30"
                      : "bg-card border-border hover:border-accent/20"
                }`}
              >
                <button
                  onClick={() => !unavailable && toggleSelect(entry.fullName)}
                  className="mt-0.5 shrink-0"
                  disabled={unavailable}
                  aria-label={selected.has(entry.fullName) ? "Deselect" : "Select"}
                >
                  {unavailable ? (
                    <CheckSquare className="w-4 h-4 text-muted" />
                  ) : selected.has(entry.fullName) ? (
                    <CheckSquare className="w-4 h-4 text-accent" />
                  ) : (
                    <Square className="w-4 h-4 text-muted" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs text-muted font-mono">#{entry.rank}</span>
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:text-accent">
                      {entry.fullName}
                    </a>
                    {entry.language && <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">{entry.language}</span>}
                    {entry.imported && <span className="text-[10px] text-accent">Reviewed</span>}
                    {entry.queued && !entry.imported && (
                      <span className="text-[10px] text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> In queue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted line-clamp-1">{entry.description}</p>
                  {(entry.starsToday || entry.metricValue) && (
                    <p className="text-[10px] text-warning mt-0.5 flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {entry.starsToday ?? `${entry.metricLabel}: ${entry.metricValue}`}
                    </p>
                  )}
                </div>
              </div>
            );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>
              Showing {visibleEntries.length} of {entries.length}
            </span>
            {hasMore && (
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-card-hover text-sm text-foreground"
              >
                Load more
              </button>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
