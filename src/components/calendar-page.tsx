"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Calendar as CalIcon,
  List,
  LayoutGrid,
} from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

interface Slot {
  id: string;
  title: string;
  scheduledAt: string;
  platform: string;
  status: string;
  projectId: string | null;
  project?: { id: string; name: string | null; status: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-slate-500/20 border-slate-500/40 text-slate-300",
  SCHEDULED: "bg-info/20 border-info/40 text-blue-300",
  RECORDED: "bg-purple-500/20 border-purple-500/40 text-purple-300",
  PUBLISHED: "bg-accent/20 border-accent/40 text-accent",
  SKIPPED: "bg-muted/20 border-muted/40 text-muted",
};

const PLATFORMS = ["YOUTUBE", "LINKEDIN", "SHORTS", "TWITTER", "BLOG"];

export function CalendarPageClient() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "week" | "list">("month");
  const [cursor, setCursor] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    scheduledAt: "",
    platform: "YOUTUBE",
    status: "PLANNED",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/calendar");
    const data = await res.json();
    setSlots(data.slots ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    setForm({ title: "", scheduledAt: "", platform: "YOUTUBE", status: "PLANNED" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startPad = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const slotsByDay = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const key = new Date(s.scheduledAt).toDateString();
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() - d.getDay() + i);
    return d;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Calendar" }]} />
      <PageHeader
        title="Content Calendar"
        description="Schedule publishes, recordings, and cross-posts"
        helpHref="/help"
        actions={
          <>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {(["month", "week", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1.5 flex items-center gap-1",
                    view === v ? "bg-accent/10 text-accent" : "hover:bg-card-hover"
                  )}
                >
                  {v === "month" && <LayoutGrid className="w-3 h-3" />}
                  {v === "week" && <CalIcon className="w-3 h-3" />}
                  {v === "list" && <List className="w-3 h-3" />}
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-sm"
            >
              <Plus className="w-4 h-4" />
              New slot
            </button>
          </>
        }
      />

      {showForm && (
        <form onSubmit={createSlot} className="mb-6 p-4 rounded-xl bg-card border border-border grid sm:grid-cols-2 gap-3">
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
          <input
            required
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-white text-sm">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-2 rounded hover:bg-card-hover">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-2 rounded hover:bg-card-hover">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : view === "month" ? (
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-[10px] text-muted py-1">{d}</div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] bg-card/30 rounded-lg" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const d = new Date(cursor.getFullYear(), cursor.getMonth(), day);
            const daySlots = slotsByDay[d.toDateString()] ?? [];
            return (
              <div key={day} className="min-h-[80px] p-1 rounded-lg bg-card border border-border/50">
                <span className="text-[10px] text-muted">{day}</span>
                <div className="space-y-0.5 mt-0.5">
                  {daySlots.slice(0, 2).map((s) => (
                    <div
                      key={s.id}
                      className={cn("text-[9px] px-1 py-0.5 rounded border truncate cursor-pointer", STATUS_COLORS[s.status])}
                      title={s.title}
                      onClick={() => updateStatus(s.id, s.status === "PLANNED" ? "SCHEDULED" : s.status === "SCHEDULED" ? "RECORDED" : "PUBLISHED")}
                    >
                      {s.title}
                    </div>
                  ))}
                  {daySlots.length > 2 && <span className="text-[9px] text-muted">+{daySlots.length - 2}</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === "week" ? (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d) => {
            const daySlots = slotsByDay[d.toDateString()] ?? [];
            return (
              <div key={d.toISOString()} className="p-2 rounded-xl bg-card border border-border min-h-[120px]">
                <p className="text-xs font-medium mb-2">{d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}</p>
                {daySlots.map((s) => (
                  <div key={s.id} className={cn("text-xs p-1.5 mb-1 rounded border", STATUS_COLORS[s.status])}>
                    {s.title}
                    {s.project && (
                      <Link href={`/studio/${s.project.id}`} className="block text-[10px] underline mt-0.5">Studio →</Link>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((s) => (
            <div key={s.id} className={cn("flex items-center gap-3 p-3 rounded-xl border", STATUS_COLORS[s.status])}>
              <span className="text-xs text-muted w-28 shrink-0">{new Date(s.scheduledAt).toLocaleString()}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-background/50">{s.platform}</span>
              <span className="flex-1 font-medium text-sm">{s.title}</span>
              <select
                value={s.status}
                onChange={(e) => updateStatus(s.id, e.target.value)}
                className="bg-background border border-border rounded text-xs px-2 py-1"
              >
                {Object.keys(STATUS_COLORS).map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {s.projectId && (
                <Link href={`/studio/${s.projectId}`} className="text-xs text-accent hover:underline">Studio</Link>
              )}
            </div>
          ))}
          {slots.length === 0 && <p className="text-muted text-sm py-8 text-center">No slots yet — create one above</p>}
        </div>
      )}

      <p className="text-xs text-muted mt-6">Click a slot in month view to advance status: Planned → Scheduled → Recorded → Published</p>
    </div>
  );
}
