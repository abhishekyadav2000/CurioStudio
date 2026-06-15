"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Loader2, Calendar, Tag, Trash2, Copy } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/badges";
import { formatRelative } from "@/lib/utils";
import type { ProjectStatus } from "@prisma/client";

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
    <div className="max-w-5xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Projects" }]} />
      <PageHeader
        title="Projects"
        description="All repos in your pipeline — batch schedule or remove duplicates"
        helpHref="/help"
        actions={
          <div className="flex gap-2 flex-wrap">
            {duplicateIds.size > 0 && (
              <button
                onClick={selectDuplicates}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-amber-500/40 text-amber-400 text-sm hover:bg-amber-500/10"
              >
                <Copy className="w-4 h-4" />
                Select duplicates ({duplicateIds.size})
              </button>
            )}
            {selected.size > 0 && (
              <>
                <button
                  onClick={batchSchedule}
                  disabled={batching || deleting}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-50"
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
                  Delete selected
                </button>
              </>
            )}
          </div>
        }
      />

      {duplicateIds.size > 0 && (
        <p className="mb-4 text-xs text-amber-400/90">
          {duplicateIds.size} duplicate project(s) detected (same URL or name). Select and delete extras.
        </p>
      )}

      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
      ) : projects.length === 0 ? (
        <p className="text-center text-muted py-12">
          No projects — start from <Link href="/discover" className="text-accent">Discover</Link>
        </p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const tags: string[] = p.tags ? JSON.parse(p.tags) : [];
            const isDuplicate = duplicateIds.has(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-4 rounded-xl bg-card border transition-all ${
                  isDuplicate ? "border-amber-500/30 hover:border-amber-500/50" : "border-border hover:border-accent/20"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="rounded accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/projects/${p.id}`} className="font-semibold hover:text-accent truncate">
                      {p.name}
                    </Link>
                    <StatusBadge status={p.status as ProjectStatus} />
                    {isDuplicate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Duplicate
                      </span>
                    )}
                    {tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-1 truncate">{p.url}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {p.workflowStep} · {formatRelative(p.updatedAt)}
                    {p.scheduledPublishAt && ` · Publish ${new Date(p.scheduledPublishAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {p.status === "SCRIPT_READY" && (
                    <Link href={`/studio/${p.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white">
                      Studio
                    </Link>
                  )}
                  <Link href={`/projects/${p.id}`} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-card-hover">
                    View
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
