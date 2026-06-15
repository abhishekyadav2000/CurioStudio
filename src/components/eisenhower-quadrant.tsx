"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type QuadrantType = "DELEGATE" | "DO_NOW" | "DO_LATER" | "PLAN";

interface QuadrantItem {
  id: string;
  quadrant: QuadrantType;
  text: string;
  order: number;
}

const QUADRANT_CONFIG: Record<
  QuadrantType,
  { label: string; hint: string; accent: string; border: string; bg: string }
> = {
  DELEGATE: {
    label: "DELEGATE",
    hint: "These are often tasks for others. Re-assess, and if needed delegate.",
    accent: "text-orange-400",
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
  },
  DO_NOW: {
    label: "DO IT NOW",
    hint: "Most critical tasks. Prioritize according to urgency.",
    accent: "text-amber-300",
    border: "border-amber-500/50",
    bg: "bg-amber-500/15",
  },
  DO_LATER: {
    label: "DO IT LATER",
    hint: "Non-productive tasks. Delay or delete.",
    accent: "text-slate-400",
    border: "border-slate-500/40",
    bg: "bg-slate-500/10",
  },
  PLAN: {
    label: "PLAN",
    hint: "Strategic tasks. Schedule time to plan and execute.",
    accent: "text-yellow-400",
    border: "border-yellow-500/40",
    bg: "bg-yellow-500/10",
  },
};

const GRID: { quadrant: QuadrantType; row: "urgent" | "not-urgent"; col: "not-important" | "important" }[] = [
  { quadrant: "DELEGATE", row: "urgent", col: "not-important" },
  { quadrant: "DO_NOW", row: "urgent", col: "important" },
  { quadrant: "DO_LATER", row: "not-urgent", col: "not-important" },
  { quadrant: "PLAN", row: "not-urgent", col: "important" },
];

function QuadrantCell({
  quadrant,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  quadrant: QuadrantType;
  items: QuadrantItem[];
  onAdd: (quadrant: QuadrantType, text: string) => Promise<void>;
  onUpdate: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const config = QUADRANT_CONFIG[quadrant];
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    try {
      await onAdd(quadrant, newText);
      setNewText("");
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    await onUpdate(id, editText);
    setEditingId(null);
  }

  return (
    <div
      className={cn(
        "flex flex-col min-h-[220px] rounded-xl border p-3",
        config.border,
        config.bg
      )}
    >
      <div className="mb-2">
        <h4 className={cn("text-xs font-bold tracking-wide", config.accent)}>{config.label}</h4>
        <p className="text-[10px] text-muted mt-0.5 leading-snug">{config.hint}</p>
      </div>

      <ul className="flex-1 space-y-1.5 mb-2 overflow-y-auto scrollbar-thin max-h-40">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="flex items-center gap-1">
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(item.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 bg-background/80 border border-border rounded px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => saveEdit(item.id)}
                className="p-1 rounded hover:bg-card-hover text-accent"
                title="Save"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="p-1 rounded hover:bg-card-hover text-muted"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </li>
          ) : (
            <li
              key={item.id}
              className="group flex items-start gap-1 bg-background/40 rounded px-2 py-1.5 text-xs hover:bg-background/60"
            >
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => {
                  setEditingId(item.id);
                  setEditText(item.text);
                }}
              >
                {item.text}
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-danger/20 text-danger shrink-0"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          )
        )}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-1 mt-auto">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add item…"
          className="flex-1 bg-background/80 border border-border rounded px-2 py-1 text-xs placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={adding || !newText.trim()}
          className="p-1.5 rounded bg-card border border-border hover:bg-card-hover disabled:opacity-40"
          title="Add"
        >
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </button>
      </form>
    </div>
  );
}

export function EisenhowerQuadrant() {
  const [items, setItems] = useState<QuadrantItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/calendar/quadrant");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addItem(quadrant: QuadrantType, text: string) {
    const res = await fetch("/api/calendar/quadrant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quadrant, text }),
    });
    const data = await res.json();
    if (data.item) setItems((prev) => [...prev, data.item]);
  }

  async function updateItem(id: string, text: string) {
    const res = await fetch("/api/calendar/quadrant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text }),
    });
    const data = await res.json();
    if (data.item) {
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
    }
  }

  async function deleteItem(id: string) {
    await fetch(`/api/calendar/quadrant?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const byQuadrant = (q: QuadrantType) =>
    items.filter((i) => i.quadrant === q).sort((a, b) => a.order - b.order);

  return (
    <section className="mt-2">
      <h3 className="text-sm font-semibold mb-1">Urgent vs Important Quadrant</h3>
      <p className="text-xs text-muted mb-4">
        Eisenhower matrix — add tasks to each quadrant. Click an item to edit inline.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : (
        <div className="relative">
          {/* Column axis labels */}
          <div className="grid grid-cols-[auto_1fr_1fr] gap-2 mb-1 pl-8">
            <div />
            <p className="text-[10px] font-semibold text-orange-400/80 text-center uppercase tracking-wider">
              Not Important
            </p>
            <p className="text-[10px] font-semibold text-amber-400/80 text-center uppercase tracking-wider">
              Important
            </p>
          </div>

          <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
            {/* Urgent row */}
            <p className="text-[10px] font-semibold text-orange-400/80 uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 flex items-center justify-center px-1">
              Urgent
            </p>
            {GRID.filter((g) => g.row === "urgent").map(({ quadrant }) => (
              <QuadrantCell
                key={quadrant}
                quadrant={quadrant}
                items={byQuadrant(quadrant)}
                onAdd={addItem}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ))}

            {/* Not urgent row */}
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider [writing-mode:vertical-lr] rotate-180 flex items-center justify-center px-1">
              Not Urgent
            </p>
            {GRID.filter((g) => g.row === "not-urgent").map(({ quadrant }) => (
              <QuadrantCell
                key={quadrant}
                quadrant={quadrant}
                items={byQuadrant(quadrant)}
                onAdd={addItem}
                onUpdate={updateItem}
                onDelete={deleteItem}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
