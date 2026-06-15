"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

interface Sop {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
}

export function ProcessesPageClient({ initialSlug }: { initialSlug?: string }) {
  const [sops, setSops] = useState<Sop[]>([]);
  const [selected, setSelected] = useState<Sop | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/processes");
    const data = await res.json();
    setSops(data.sops ?? []);
    if (initialSlug) {
      const match = (data.sops ?? []).find((s: Sop) => s.slug === initialSlug);
      if (match) {
        setSelected(match);
        setContent(match.content);
      }
    } else if (data.sops?.[0]) {
      setSelected(data.sops[0]);
      setContent(data.sops[0].content);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [initialSlug]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    await fetch("/api/processes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, content }),
    });
    setSaving(false);
    load();
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Processes" }]} />
      <PageHeader
        title="SOP Library"
        description="Standard operating procedures — editable markdown, linked from Help Center"
        helpHref="/help"
      />

      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 shrink-0 space-y-1">
            {sops.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelected(s);
                  setContent(s.content);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  selected?.id === s.id ? "bg-accent/10 text-accent" : "hover:bg-card-hover text-muted"
                }`}
              >
                <span className="block text-[10px] uppercase text-muted">{s.category}</span>
                {s.title}
              </button>
            ))}
          </aside>
          <div className="flex-1 min-w-0">
            {selected && (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-semibold">{selected.title}</h2>
                  <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-sm"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-[60vh] font-mono text-sm bg-card border border-border rounded-xl p-4 resize-y"
                />
                <div className="mt-4 p-4 rounded-xl bg-card border border-border prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-muted font-sans">{content}</pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
