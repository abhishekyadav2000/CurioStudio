"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Loader2, Calendar, Tag, Trash2, Copy } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/badges";
import { formatRelative } from "@/lib/utils";
import type { ProjectStatus } from "@prisma/client";

const PAGE_SIZE = 20;
const SCROLL_LIST = "rounded-xl border border-border bg-card/30 max-h-[min(520px,60vh)] overflow-y-auto";

interface Project {
  id: string;
  name: string | null;
  url: string;
  status: ProjectStatus;
  tags: string | null;
  workflowStep: string;
  scheduledPublishAt: string | null;
  updatedAt: string;
  stars: number | null;
}

function normalizeKey(project: Project) {
  const url = project.url.trim().toLowerCase().replace(/\/$/, "");
  const name = (project.name ?? "").trim().toLowerCase();
  return url || name;
}

export function ProjectsPageClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batching, setBatching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  const duplicateIds = useMemo(() => {
    const groups = new Map<string, Project[]>();
    for (const p of projects) {
      const key = normalizeKey(p);
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(p);
      groups.set(key, group);
    }
    const dupes = new Set<string>();
    for (const group of groups.values()) {
      if (group.length > 1) {
        for (const p of group) dupes.add(p.id);
      }
    }
    return dupes;
  }, [projects]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectDuplicates() {
    setSelected(new Set(duplicateIds));
  }

  async function batchSchedule() {
    setBatching(true);
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batch", projectIds: [...selected] }),
    });
    setBatching(false);
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} project(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setProjects((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden max-w-5xl mx-auto p-4 lg:p-6">
      <div className="shrink-0">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Projects" }]} />
      <PageHeader
        title="Projects"
        description="Review results, export research PDFs, open Studio to record"
        helpHref="/help"
        actions={
          selected.size > 0 ? (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={batchSchedule}
                disabled={batching || deleting}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card-hover disabled:opacity-50"
              >
                {batching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Schedule {selected.size}
              </button>
              <button
                onClick={deleteSelected}
                disabled={batching || deleting}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-red-500/40 text-red-400 text-sm hover:bg-red-500/10 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete {selected.size}
              </button>
            </div>
          ) : duplicateIds.size > 0 ? (
            <button
              onClick={selectDuplicates}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-amber-500/30 text-amber-400/90 text-xs hover:bg-amber-500/10"
            >
              <Copy className="w-3.5 h-3.5" />
              Select {duplicateIds.size} duplicates
            </button>
          ) : null
        }
      />
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
      ) : projects.length === 0 ? (
        <p className="text-center text-muted py-12">
          No projects — start from <Link href="/discover" className="text-accent">Discover</Link>
        </p>
      ) : (
        <>
          <div className={`${SCROLL_LIST} flex-1 min-h-0`}>
            <div className="space-y-1.5 p-2">
          {projects.slice(0, visibleCount).map((p) => {
            const tags: string[] = p.tags ? JSON.parse(p.tags) : [];
            const isDuplicate = duplicateIds.has(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl bg-card border transition-all ${
                  selected.has(p.id)
                    ? "border-accent/30"
                    : isDuplicate
                      ? "border-amber-500/20 hover:border-amber-500/40"
                      : "border-border hover:border-accent/20"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="rounded accent-accent shrink-0"
                />
                <Link href={`/projects/${p.id}`} className="flex-1 min-w-0 group">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold group-hover:text-accent truncate">{p.name}</span>
                    <StatusBadge status={p.status as ProjectStatus} />
                    {isDuplicate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                        dup
                      </span>
                    )}
                    {tags.slice(0, 2).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {p.workflowStep} · {formatRelative(p.updatedAt)}
                  </p>
                </Link>
              </div>
            );
          })}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted shrink-0">
            <span>Showing {Math.min(visibleCount, projects.length)} of {projects.length}</span>
            {visibleCount < projects.length && (
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-card-hover text-sm text-foreground"
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
