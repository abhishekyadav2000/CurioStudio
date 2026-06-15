"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarEventData {
  id?: string;
  title: string;
  scheduledAt: string;
  endAt: string;
  location: string;
  notes: string;
  agenda: string;
  availability: "BUSY" | "FREE" | "TENTATIVE";
  platform: string;
  status: string;
}

interface CalendarEventModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial: CalendarEventData;
  dayEvents: { id: string; title: string; scheduledAt: string; endAt?: string | null }[];
  onClose: () => void;
  onSave: (data: CalendarEventData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const PLATFORMS = ["YOUTUBE", "LINKEDIN", "SHORTS", "TWITTER", "BLOG"];
const SLOT_STATUSES = ["PLANNED", "SCHEDULED", "RECORDED", "PUBLISHED", "SKIPPED"];
const AVAILABILITY = ["BUSY", "FREE", "TENTATIVE"] as const;

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocal(s: string): Date {
  return new Date(s);
}

function DayTimeline({
  start,
  end,
  events,
}: {
  start: Date;
  end: Date;
  events: { id: string; title: string; scheduledAt: string; endAt?: string | null }[];
}) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);

  const eventBlocks = useMemo(() => {
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return events
      .map((ev) => {
        const evStart = new Date(ev.scheduledAt);
        const evEnd = ev.endAt ? new Date(ev.endAt) : new Date(evStart.getTime() + 3600000);
        if (evEnd <= dayStart || evStart >= dayEnd) return null;
        const top = ((evStart.getHours() + evStart.getMinutes() / 60 - 7) / 13) * 100;
        const height = Math.max(((evEnd.getTime() - evStart.getTime()) / 3600000 / 13) * 100, 4);
        return { id: ev.id, title: ev.title, top, height, isCurrent: false };
      })
      .filter(Boolean) as { id: string; title: string; top: number; height: number; isCurrent: boolean }[];
  }, [events, start]);

  const currentTop = ((start.getHours() + start.getMinutes() / 60 - 7) / 13) * 100;
  const currentHeight = Math.max(((end.getTime() - start.getTime()) / 3600000 / 13) * 100, 4);

  return (
    <div className="flex flex-col h-full min-h-[320px]">
      <p className="text-xs font-medium text-muted mb-2">
        {start.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
      </p>
      <div className="relative flex-1 border border-border rounded-lg bg-background/50 overflow-hidden">
        {hours.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border/40 flex"
            style={{ top: `${((h - 7) / 13) * 100}%` }}
          >
            <span className="text-[9px] text-muted w-10 shrink-0 -mt-2 pl-1">
              {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
            </span>
          </div>
        ))}
        {eventBlocks.map((block) => (
          <div
            key={block.id}
            className="absolute left-10 right-1 rounded bg-purple-500/30 border border-purple-500/50 px-1 py-0.5 overflow-hidden"
            style={{ top: `${Math.max(block.top, 0)}%`, height: `${block.height}%`, minHeight: 18 }}
          >
            <span className="text-[9px] text-purple-200 truncate block">{block.title}</span>
          </div>
        ))}
        <div
          className="absolute left-10 right-1 rounded bg-accent/40 border-2 border-accent px-1 py-0.5 z-10"
          style={{ top: `${Math.max(currentTop, 0)}%`, height: `${currentHeight}%`, minHeight: 20 }}
        >
          <span className="text-[9px] text-white font-medium truncate block">
            {start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            {" – "}
            {end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CalendarEventModal({
  open,
  mode,
  initial,
  dayEvents,
  onClose,
  onSave,
  onDelete,
}: CalendarEventModalProps) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const startDate = form.scheduledAt ? parseLocal(form.scheduledAt) : new Date();
  const endDate = form.endAt ? parseLocal(form.endAt) : new Date(startDate.getTime() + 3600000);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduledAt) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id || !onDelete) return;
    if (!confirm("Delete this event?")) return;
    setDeleting(true);
    try {
      await onDelete(form.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-semibold">
            {mode === "create" ? "New event" : "Edit event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-card-hover text-muted"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="grid md:grid-cols-[1fr_220px] gap-0">
            <div className="p-5 space-y-4 border-b md:border-b-0 md:border-r border-border">
              <input
                required
                autoFocus
                placeholder="Add title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-transparent text-lg font-medium outline-none placeholder:text-muted border-b border-border pb-2"
              />

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wide">Start</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wide">End</label>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted uppercase tracking-wide">Location</label>
                <input
                  placeholder="Add location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted uppercase tracking-wide">Description / notes</label>
                <textarea
                  rows={3}
                  placeholder="Add description or notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm resize-y min-h-[72px]"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted uppercase tracking-wide">Agenda</label>
                <textarea
                  rows={2}
                  placeholder="Meeting agenda or talking points"
                  value={form.agenda}
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm resize-y"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wide">Show as</label>
                  <select
                    value={form.availability}
                    onChange={(e) =>
                      setForm({ ...form, availability: e.target.value as CalendarEventData["availability"] })
                    }
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {AVAILABILITY.map((a) => (
                      <option key={a} value={a}>
                        {a.charAt(0) + a.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wide">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wide">Slot status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {SLOT_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 bg-background/30 hidden md:block">
              <DayTimeline start={startDate} end={endDate} events={dayEvents} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-card">
            <div>
              {mode === "edit" && form.id && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg border border-danger/50 text-danger text-sm hover:bg-danger/10 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-card-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  "px-5 py-2 rounded-lg text-white text-sm font-medium",
                  "bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export { toDatetimeLocal };
