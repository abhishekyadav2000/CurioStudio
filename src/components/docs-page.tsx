"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

interface Doc {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
}

export function DocsPageClient({ initialSlug }: { initialSlug?: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/docs");
    const data = await res.json();
    setDocs(data.docs ?? []);
    const match = initialSlug
      ? (data.docs ?? []).find((d: Doc) => d.slug === initialSlug)
      : data.docs?.[0];
    if (match) {
      setSelected(match);
      setContent(match.content);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [initialSlug]);

  async function save() {
    if (!selected) return;
    setSaving(true);
    await fetch("/api/docs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selected.id, content }),
    });
    setSaving(false);
  }

  const categories = [...new Set(docs.map((d) => d.category))];

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Docs" }]} />
      <PageHeader title="Knowledge Base" description="Architecture, API reference, workflows — editable markdown" helpHref="/help" />

      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-52 shrink-0">
            {categories.map((cat) => (
              <div key={cat} className="mb-4">
                <p className="text-[10px] uppercase text-muted font-semibold mb-1 px-2">{cat}</p>
                {docs.filter((d) => d.category === cat).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelected(d);
                      setContent(d.content);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                      selected?.id === d.id ? "bg-accent/10 text-accent" : "hover:bg-card-hover text-muted"
                    }`}
                  >
                    {d.title}
                  </button>
                ))}
              </div>
            ))}
          </aside>
          <div className="flex-1 min-w-0">
            {selected && (
              <>
                <div className="flex justify-between mb-3">
                  <h2 className="text-xl font-bold">{selected.title}</h2>
                  <button onClick={save} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-sm">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-48 font-mono text-xs bg-card border border-border rounded-xl p-3 mb-4"
                />
                <article className="prose prose-invert prose-sm max-w-none p-4 rounded-xl bg-card border border-border">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{content}</pre>
                </article>
                <p className="text-xs text-muted mt-2">
                  Permalink: <Link href={`/docs/${selected.slug}`} className="text-accent">/docs/{selected.slug}</Link>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
