"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

export function NotesPanel({
  projectId,
  initialNotes,
}: {
  projectId: string;
  initialNotes: { id: string; content: string; createdAt: string }[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const note = await res.json();
      if (res.ok) {
        setNotes([note, ...notes]);
        setContent("");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a manual note…"
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent-dim disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </form>
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {notes.length === 0 ? (
          <p className="text-sm text-muted">No notes yet</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-3 rounded-lg bg-background border border-border text-sm">
              <p className="text-foreground">{note.content}</p>
              <p className="text-xs text-muted mt-1">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
