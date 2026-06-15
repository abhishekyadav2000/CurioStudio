"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Keyboard, ArrowRight } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

const GUIDES = [
  { title: "Getting Started", href: "/docs/architecture", desc: "Architecture and daily flow" },
  { title: "Daily Workflow", href: "/processes?slug=daily-review", desc: "Morning review SOP" },
  { title: "Full Documentation", href: "/docs", desc: "API, env vars, troubleshooting" },
];

const SHORTCUTS = [
  { keys: "⌘ K", action: "Global search" },
  { keys: "Esc", action: "Close dialogs" },
];

export function HelpPageClient() {
  const [query, setQuery] = useState("");

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Help" }]} />
      <PageHeader
        title="Help"
        description="Quick links — see Docs for full guides"
      />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter guides…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm"
        />
      </div>

      <section className="mb-6 p-4 rounded-xl bg-accent/5 border border-accent/20">
        <p className="text-sm font-medium mb-2">Daily workflow</p>
        <p className="text-xs text-muted">
          Discover → Queue → Results (Research PDF) → Studio (record) → Publish
        </p>
        <Link href="/docs/workflow-pipeline" className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-2">
          Full pipeline diagram in Docs <ArrowRight className="w-3 h-3" />
        </Link>
      </section>

      <section className="mb-6">
        <h3 className="text-sm font-semibold mb-2">Guides</h3>
        <div className="space-y-2">
          {GUIDES.filter((g) => !query || g.title.toLowerCase().includes(query.toLowerCase())).map((g) => (
            <Link key={g.href} href={g.href} className="block p-3 rounded-xl bg-card border border-border hover:border-accent/30">
              <p className="font-medium text-sm">{g.title}</p>
              <p className="text-xs text-muted mt-0.5">{g.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-accent" /> Shortcuts
        </h3>
        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex justify-between text-sm p-2 rounded-lg bg-card border border-border">
              <span className="text-muted">{s.action}</span>
              <kbd className="text-xs px-2 py-0.5 rounded border border-border font-mono">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
