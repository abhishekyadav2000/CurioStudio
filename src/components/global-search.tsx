"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, FileText, Folder, Calendar, BookOpen, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: "project" | "doc" | "slot" | "sop";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const ICONS = {
  project: Folder,
  doc: BookOpen,
  slot: Calendar,
  sop: FileText,
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/60" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, docs, calendar…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <kbd className="text-[10px] text-muted px-1.5 py-0.5 rounded border border-border">esc</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          {loading && <p className="p-4 text-sm text-muted">Searching…</p>}
          {!loading && query && results.length === 0 && (
            <p className="p-4 text-sm text-muted">No results for &quot;{query}&quot;</p>
          )}
          {results.map((r) => {
            const Icon = ICONS[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => navigate(r.href)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-card-hover text-left"
              >
                <Icon className="w-4 h-4 text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-muted truncate">{r.subtitle}</p>}
                </div>
              </button>
            );
          })}
          {!query && (
            <p className="p-4 text-xs text-muted">
              Try: project name, doc slug, calendar title
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SearchTrigger({ collapsed }: { collapsed?: boolean }) {
  const [, setTick] = useState(0);
  return (
    <button
      onClick={() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
        setTick((t) => t + 1);
      }}
      className={`flex items-center rounded-lg border border-border hover:bg-card-hover text-muted text-xs ${
        collapsed
          ? "w-full min-h-[52px] flex-col justify-center gap-0.5 px-1 py-2"
          : "gap-2 px-3 py-2 w-full"
      }`}
      title={collapsed ? "Search (⌘K)" : undefined}
    >
      <Search className="w-5 h-5 shrink-0" />
      {collapsed ? (
        <span className="text-[9px] leading-none font-medium">Search</span>
      ) : (
        <>
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] px-1 rounded border border-border">⌘K</kbd>
        </>
      )}
    </button>
  );
}
