"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Radar,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

type LeadStatus = "NEW" | "APPLIED" | "ARCHIVED";
type LeadSource = "HN" | "REMOTEOK" | "GREENHOUSE" | "GITHUB" | "MANUAL";

interface CompanyUpdate {
  id: string;
  type: string;
  title: string;
  url?: string | null;
  summary?: string | null;
  capturedAt: string;
}

interface Company {
  id: string;
  name: string;
  website?: string | null;
  githubOrg?: string | null;
  industry?: string | null;
  greenhouseSlug?: string | null;
  leverSlug?: string | null;
  _count?: { jobLeads: number; updates: number };
  newLeadCount?: number;
  updates?: CompanyUpdate[];
}

interface JobLead {
  id: string;
  title: string;
  url: string;
  source: LeadSource;
  companyName?: string | null;
  location?: string | null;
  remote?: boolean | null;
  postedAt?: string | null;
  description?: string | null;
  status: LeadStatus;
  capturedAt: string;
  company?: Company | null;
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  HN: "Hacker News",
  REMOTEOK: "RemoteOK",
  GREENHOUSE: "Greenhouse / Lever",
  GITHUB: "GitHub",
  MANUAL: "Manual",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "text-accent border-accent/30 bg-accent/10",
  APPLIED: "text-info border-info/30 bg-info/10",
  ARCHIVED: "text-muted border-border bg-card",
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(iso?: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleString();
}

export function LeadsPageClient() {
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState({ totalOpen: 0, newToday: 0, companiesTracked: 0 });
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "ALL">("NEW");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);

  const [manualLead, setManualLead] = useState({
    title: "",
    url: "",
    companyName: "",
    location: "",
    description: "",
  });
  const [newCompany, setNewCompany] = useState({
    name: "",
    website: "",
    githubOrg: "",
    greenhouseSlug: "",
    leverSlug: "",
  });

  const load = useCallback(async (filters?: { status?: string; source?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters?.source && filters.source !== "ALL") params.set("source", filters.source);

    const [leadsRes, companiesRes] = await Promise.all([
      fetch(`/api/leads?${params}`).then((r) => r.json()),
      fetch("/api/leads/companies").then((r) => r.json()),
    ]);

    setLeads(leadsRes.leads ?? []);
    setStats(leadsRes.stats ?? { totalOpen: 0, newToday: 0, companiesTracked: 0 });
    setLastScanAt(leadsRes.lastScanAt ?? null);
    setCompanies(companiesRes.companies ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load({ status: statusFilter, source: sourceFilter });
  }, [statusFilter, sourceFilter, load]);

  async function runScan() {
    setScanning(true);
    try {
      await fetch("/api/leads/scan", { method: "POST" });
      await load({ status: statusFilter, source: sourceFilter });
    } finally {
      setScanning(false);
    }
  }

  async function updateStatus(id: string, status: LeadStatus) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  }

  async function deleteLead(id: string) {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  async function addManualLead(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...manualLead, source: "MANUAL" }),
    });
    if (res.ok) {
      setManualLead({ title: "", url: "", companyName: "", location: "", description: "" });
      setShowAddLead(false);
      load({ status: statusFilter, source: sourceFilter });
    }
  }

  async function addCompany(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/leads/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCompany),
    });
    if (res.ok) {
      setNewCompany({ name: "", website: "", githubOrg: "", greenhouseSlug: "", leverSlug: "" });
      setShowAddCompany(false);
      load({ status: statusFilter, source: sourceFilter });
    }
  }

  const filteredLeads = leads;

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Insider Tracker" }]} />
      <PageHeader
        title="Insider Tracker"
        description="Auto-capture job openings, companies, and hiring signals — no manual hunting"
        actions={
          <>
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim disabled:opacity-60"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Scan now
            </button>
            <button
              onClick={() => setShowAddLead(!showAddLead)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card-hover"
            >
              <Plus className="w-4 h-4" />
              Add lead
            </button>
          </>
        }
      />

      <p className="text-xs text-muted mb-4">
        Last scan: {formatRelative(lastScanAt)}
        <span className="mx-2">·</span>
        Tip: run Scan daily to catch new postings — cron automation coming soon
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "New today", value: stats.newToday, accent: true },
          { label: "Total open", value: stats.totalOpen },
          { label: "Companies tracked", value: stats.companiesTracked },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border">
            <p className="text-[10px] text-muted uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.accent ? "text-accent" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["ALL", "NEW", "APPLIED", "ARCHIVED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              statusFilter === s ? "bg-accent/10 text-accent border border-accent/30" : "border border-border hover:bg-card-hover"
            }`}
          >
            {s === "ALL" ? "All statuses" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        <span className="w-px bg-border mx-1" />
        {(["ALL", "HN", "REMOTEOK", "GITHUB", "GREENHOUSE", "MANUAL"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSourceFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              sourceFilter === s ? "bg-accent/10 text-accent border border-accent/30" : "border border-border hover:bg-card-hover"
            }`}
          >
            {s === "ALL" ? "All sources" : SOURCE_LABELS[s as LeadSource]}
          </button>
        ))}
      </div>

      {/* Manual add lead form */}
      {showAddLead && (
        <form onSubmit={addManualLead} className="mb-6 p-4 rounded-xl bg-card border border-border space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-accent" /> Add manual lead
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Job title"
              value={manualLead.title}
              onChange={(e) => setManualLead({ ...manualLead, title: e.target.value })}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="URL"
              type="url"
              value={manualLead.url}
              onChange={(e) => setManualLead({ ...manualLead, url: e.target.value })}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Company name"
              value={manualLead.companyName}
              onChange={(e) => setManualLead({ ...manualLead, companyName: e.target.value })}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Location"
              value={manualLead.location}
              onChange={(e) => setManualLead({ ...manualLead, location: e.target.value })}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={manualLead.description}
            onChange={(e) => setManualLead({ ...manualLead, description: e.target.value })}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm min-h-[80px]"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-accent text-white text-sm">
            Save lead
          </button>
        </form>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Lead list */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Radar className="w-4 h-4 text-accent" />
            Job leads ({filteredLeads.length})
          </h3>

          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center text-sm text-muted">
              <Radar className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No leads yet — click <strong className="text-accent">Scan now</strong> to pull from HN, RemoteOK, GitHub &amp; ATS boards
            </div>
          ) : (
            filteredLeads.map((lead) => (
              <div key={lead.id} className="rounded-xl bg-card border border-border overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-card-hover transition-colors"
                  onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{lead.title}</span>
                        {lead.remote && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">Remote</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted flex-wrap">
                        {lead.companyName && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {lead.companyName}
                          </span>
                        )}
                        {lead.location && <span>· {lead.location}</span>}
                        <span>· {SOURCE_LABELS[lead.source]}</span>
                        <span>· Posted {formatDate(lead.postedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) => updateStatus(lead.id, e.target.value as LeadStatus)}
                        className={`text-xs px-2 py-1 rounded-lg border ${STATUS_COLORS[lead.status]}`}
                      >
                        <option value="NEW">New</option>
                        <option value="APPLIED">Applied</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-card-hover text-muted hover:text-accent"
                        title="Open link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="p-1.5 rounded-lg hover:bg-danger/10 text-muted hover:text-danger"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedId === lead.id ? (
                        <ChevronUp className="w-4 h-4 text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedId === lead.id && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    {lead.description && (
                      <div>
                        <p className="text-[10px] text-muted uppercase mb-1">Description</p>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap line-clamp-6">{lead.description}</p>
                      </div>
                    )}
                    {lead.company?.updates && lead.company.updates.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted uppercase mb-2">Company intel</p>
                        <div className="space-y-2">
                          {lead.company.updates.map((u) => (
                            <div key={u.id} className="text-xs p-2 rounded-lg bg-background border border-border">
                              <span className="text-accent font-medium">{u.type.replace("_", " ")}</span>
                              {" — "}
                              {u.url ? (
                                <a href={u.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                                  {u.title}
                                </a>
                              ) : (
                                u.title
                              )}
                              {u.summary && <p className="text-muted mt-1">{u.summary}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted">Captured {formatDate(lead.capturedAt)}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Company watchlist */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              Company watchlist
            </h3>
            <button
              onClick={() => setShowAddCompany(!showAddCompany)}
              className="p-1.5 rounded-lg hover:bg-card-hover text-muted hover:text-accent"
              title="Add company"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showAddCompany && (
            <form onSubmit={addCompany} className="p-3 rounded-xl bg-card border border-border space-y-2">
              <input
                required
                placeholder="Company name"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Website"
                value={newCompany.website}
                onChange={(e) => setNewCompany({ ...newCompany, website: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="GitHub org"
                value={newCompany.githubOrg}
                onChange={(e) => setNewCompany({ ...newCompany, githubOrg: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Greenhouse slug"
                value={newCompany.greenhouseSlug}
                onChange={(e) => setNewCompany({ ...newCompany, greenhouseSlug: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Lever slug"
                value={newCompany.leverSlug}
                onChange={(e) => setNewCompany({ ...newCompany, leverSlug: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <button type="submit" className="w-full px-3 py-2 rounded-lg bg-accent text-white text-sm">
                Add to watchlist
              </button>
            </form>
          )}

          {companies.length === 0 ? (
            <p className="text-xs text-muted p-4 rounded-xl border border-dashed border-border">
              Add companies to monitor their GitHub orgs and ATS job boards
            </p>
          ) : (
            companies.map((co) => (
              <div key={co.id} className="p-3 rounded-xl bg-card border border-border">
                <p className="font-medium text-sm">{co.name}</p>
                <div className="text-[10px] text-muted mt-1 space-y-0.5">
                  {co.githubOrg && <p>GitHub: {co.githubOrg}</p>}
                  {co.greenhouseSlug && <p>Greenhouse: {co.greenhouseSlug}</p>}
                  {co.leverSlug && <p>Lever: {co.leverSlug}</p>}
                  {co.website && (
                    <a href={co.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {co.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-muted mt-2">
                  {co._count?.jobLeads ?? 0} leads · {co.newLeadCount ?? 0} new
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
