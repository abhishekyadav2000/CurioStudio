"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Keyboard, GitBranch } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

const GUIDES = [
  { title: "Getting Started", href: "/docs/architecture", desc: "Architecture and daily flow" },
  { title: "Daily Workflow", href: "/processes?slug=daily-review", desc: "Morning review SOP" },
  { title: "Ollama Setup", href: "/docs/api-env", desc: "Local LLM configuration" },
  { title: "Premium Connectors", href: "/settings", desc: "ChatGPT, Riverside, Canva bridges" },
  { title: "Troubleshooting", href: "/docs/faq", desc: "Localhost and cache issues" },
];

const SHORTCUTS = [
  { keys: "⌘ K", action: "Global search" },
  { keys: "Esc", action: "Close search / dialogs" },
  { keys: "Sidebar", action: "Click chevron to collapse (64px icons)" },
];

export function HelpPageClient() {
  const [faq, setFaq] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/docs?slug=faq")
      .then((r) => r.json())
      .then((d) => setFaq(d.doc?.content ?? ""));
  }, []);

  const faqLines = faq.split("\n").filter((l) => l.includes("**"));

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Help Center" }]} />
      <PageHeader title="Help Center" description="FAQs, guides, shortcuts, and workflow diagram" />

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search FAQ… (or press Cmd+K globally)"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border text-sm"
        />
      </div>

      <section className="mb-8">
        <h3 className="font-semibold mb-3">Guides</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {GUIDES.filter((g) => !query || g.title.toLowerCase().includes(query.toLowerCase())).map((g) => (
            <Link key={g.href} href={g.href} className="p-4 rounded-xl bg-card border border-border hover:border-accent/30">
              <p className="font-medium text-sm">{g.title}</p>
              <p className="text-xs text-muted mt-1">{g.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8 p-5 rounded-xl bg-card border border-border">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><GitBranch className="w-4 h-4 text-accent" /> Video workflow</h3>
        <pre className="text-xs font-mono text-muted overflow-x-auto">
{`Discover → Queue → Scan → Sandbox → Analyze
    → Script → Slides → Refine → Record → Edit
        → Publish → Marketing → Promote`}
        </pre>
        <div className="mt-4 text-xs text-muted">
          <p>Mermaid view in Docs → <Link href="/docs/workflow-pipeline" className="text-accent hover:underline">Production Workflow</Link></p>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Keyboard className="w-4 h-4 text-accent" /> Keyboard shortcuts</h3>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex justify-between text-sm p-2 rounded-lg bg-card border border-border">
              <span>{s.action}</span>
              <kbd className="text-xs px-2 py-0.5 rounded border border-border font-mono">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-3">FAQ</h3>
        <div className="space-y-3">
          {faqLines
            .filter((l) => !query || l.toLowerCase().includes(query.toLowerCase()))
            .map((line, i) => (
              <p key={i} className="text-sm text-muted leading-relaxed">{line.replace(/\*\*/g, "")}</p>
            ))}
        </div>
      </section>
    </div>
  );
}
