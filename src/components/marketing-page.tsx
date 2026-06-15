"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Megaphone, Hash, BarChart2, Sparkles } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

const PLATFORM_TABS = ["YOUTUBE", "LINKEDIN", "TWITTER", "SHORTS", "BLOG"] as const;

interface Campaign {
  id: string;
  name: string;
  status: string;
  platforms: string;
  linkedinPost?: string | null;
  twitterThread?: string | null;
  emailNewsletter?: string | null;
}

export function MarketingPageClient() {
  const [tab, setTab] = useState<(typeof PLATFORM_TABS)[number]>("YOUTUBE");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [hashtagSets, setHashtagSets] = useState<{ id: string; name: string; tags: string }[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown>[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [repurposePosts, setRepurposePosts] = useState<{ platform: string; title: string; body: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [manualViews, setManualViews] = useState({ views: "", ctr: "", likes: "" });

  async function load() {
    const [mRes, pRes] = await Promise.all([
      fetch("/api/marketing").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]);
    setCampaigns(mRes.campaigns ?? []);
    setHashtagSets(mRes.hashtagSets ?? []);
    setAnalytics(mRes.analytics ?? []);
    setProjects(pRes.projects ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createFromContent() {
    if (!selectedProject) return;
    await fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "from-content", projectId: selectedProject }),
    });
    load();
  }

  async function runRepurpose() {
    if (!selectedProject) return;
    const res = await fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "repurpose", projectId: selectedProject }),
    });
    const data = await res.json();
    setRepurposePosts(data.posts ?? []);
  }

  async function saveAnalytics() {
    await fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "analytics",
        projectId: selectedProject || undefined,
        platform: tab,
        views: parseInt(manualViews.views, 10) || 0,
        ctr: manualViews.ctr ? parseFloat(manualViews.ctr) : undefined,
        likes: manualViews.likes ? parseInt(manualViews.likes, 10) : undefined,
      }),
    });
    setManualViews({ views: "", ctr: "", likes: "" });
    load();
  }

  const filteredCampaigns = campaigns.filter((c) => {
    const platforms = JSON.parse(c.platforms || "[]") as string[];
    return platforms.includes(tab);
  });

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Marketing" }]} />
      <PageHeader
        title="Marketing Hub"
        description="Campaigns, hashtags, repurposing, and manual analytics"
        helpHref="/help"
      />

      <div className="mb-6 flex flex-wrap gap-2 items-end">
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={createFromContent} disabled={!selectedProject} className="px-3 py-2 rounded-lg bg-accent text-white text-sm">
          Create marketing pack
        </button>
        <button onClick={runRepurpose} disabled={!selectedProject} className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card-hover">
          <Sparkles className="w-4 h-4" />
          1 video → 5 posts
        </button>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {PLATFORM_TABS.map((p) => (
          <button
            key={p}
            onClick={() => setTab(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              tab === p ? "bg-accent/10 text-accent border border-accent/30" : "border border-border hover:bg-card-hover"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4 text-accent" /> Campaigns</h3>
            {filteredCampaigns.length === 0 ? (
              <p className="text-sm text-muted p-4 rounded-xl border border-dashed border-border">No campaigns for {tab} — create from a project</p>
            ) : (
              filteredCampaigns.map((c) => (
                <div key={c.id as string} className="p-4 rounded-xl bg-card border border-border">
                  <p className="font-medium">{c.name as string}</p>
                  <p className="text-xs text-muted mt-1">Status: {c.status as string}</p>
                  {tab === "LINKEDIN" && typeof c.linkedinPost === "string" && c.linkedinPost && (
                    <pre className="text-xs mt-2 p-2 bg-background rounded whitespace-pre-wrap">{c.linkedinPost}</pre>
                  )}
                  {tab === "TWITTER" && typeof c.twitterThread === "string" && c.twitterThread && (
                    <pre className="text-xs mt-2 p-2 bg-background rounded whitespace-pre-wrap">{c.twitterThread}</pre>
                  )}
                  {tab === "BLOG" && typeof c.emailNewsletter === "string" && c.emailNewsletter && (
                    <pre className="text-xs mt-2 p-2 bg-background rounded whitespace-pre-wrap">{c.emailNewsletter}</pre>
                  )}
                </div>
              ))
            )}

            {repurposePosts.length > 0 && (
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/20">
                <h4 className="text-sm font-semibold mb-2">Repurposed posts</h4>
                {repurposePosts.map((p, i) => (
                  <div key={i} className="mb-3 text-sm">
                    <span className="text-accent text-xs">{p.platform}</span>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-muted text-xs mt-1">{p.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><Hash className="w-4 h-4 text-accent" /> Hashtag sets</h3>
            {hashtagSets.map((h) => (
              <div key={h.id} className="p-3 rounded-xl bg-card border border-border text-sm">
                <p className="font-medium">{h.name}</p>
                <p className="text-xs text-muted mt-1">{JSON.parse(h.tags).join(" ")}</p>
              </div>
            ))}

            <h3 className="font-semibold flex items-center gap-2 mt-6"><BarChart2 className="w-4 h-4 text-accent" /> Analytics (manual entry)</h3>
            <div className="p-4 rounded-xl bg-card border border-border space-y-2">
              <p className="text-xs text-muted">Add metrics until platform APIs are connected</p>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Views" value={manualViews.views} onChange={(e) => setManualViews({ ...manualViews, views: e.target.value })} className="bg-background border border-border rounded px-2 py-1.5 text-sm" />
                <input placeholder="CTR %" value={manualViews.ctr} onChange={(e) => setManualViews({ ...manualViews, ctr: e.target.value })} className="bg-background border border-border rounded px-2 py-1.5 text-sm" />
                <input placeholder="Likes" value={manualViews.likes} onChange={(e) => setManualViews({ ...manualViews, likes: e.target.value })} className="bg-background border border-border rounded px-2 py-1.5 text-sm" />
              </div>
              <button onClick={saveAnalytics} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">Save entry</button>
            </div>
            {analytics.slice(0, 5).map((a) => (
              <div key={a.id as string} className="flex justify-between text-xs p-2 rounded bg-background/50">
                <span>{a.platform as string}</span>
                <span>{a.views as number} views{a.ctr != null ? ` · ${a.ctr}% CTR` : ""}</span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
