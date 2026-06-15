"use client";

import { useState, useEffect } from "react";
import { BarChart2 } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

export function AnalyticsPageClient() {
  const [analytics, setAnalytics] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState({ platform: "YOUTUBE", views: "", ctr: "", likes: "", notes: "" });

  async function load() {
    const res = await fetch("/api/marketing");
    const data = await res.json();
    setAnalytics(data.analytics ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analytics",
        platform: form.platform,
        views: parseInt(form.views, 10) || 0,
        ctr: form.ctr ? parseFloat(form.ctr) : undefined,
        likes: form.likes ? parseInt(form.likes, 10) : undefined,
        notes: form.notes,
      }),
    });
    setForm({ platform: "YOUTUBE", views: "", ctr: "", likes: "", notes: "" });
    load();
  }

  const totalViews = analytics.reduce((s, a) => s + ((a.views as number) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Analytics" }]} />
      <PageHeader
        title="Analytics"
        description="Manual metrics entry — platform API integration coming later"
        helpHref="/marketing"
      />

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted">Total views (logged)</p>
          <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted">Entries</p>
          <p className="text-2xl font-bold">{analytics.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <BarChart2 className="w-5 h-5 text-accent mb-1" />
          <p className="text-xs text-muted">Connect YouTube API in Settings for auto-sync</p>
        </div>
      </div>

      <form onSubmit={submit} className="p-4 rounded-xl bg-card border border-border mb-6 grid sm:grid-cols-2 gap-3">
        <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
          {["YOUTUBE", "LINKEDIN", "SHORTS", "TWITTER", "BLOG"].map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input placeholder="Views" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <input placeholder="CTR %" value={form.ctr} onChange={(e) => setForm({ ...form, ctr: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Likes" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="sm:col-span-2 bg-background border border-border rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="sm:col-span-2 px-4 py-2 rounded-lg bg-accent text-white text-sm">Add manual entry</button>
      </form>

      <div className="space-y-2">
        {analytics.map((a) => (
          <div key={a.id as string} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border text-sm">
            <span>{a.platform as string}</span>
            <span className="text-muted">{(a.views as number)?.toLocaleString()} views</span>
            {a.ctr != null && <span className="text-xs">{a.ctr as number}% CTR</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
