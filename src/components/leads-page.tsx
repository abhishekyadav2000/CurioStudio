"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Radar,
  Building2,
  ExternalLink,
  RefreshCw,
  Briefcase,
  Users,
  Mail,
  Copy,
  Check,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";

type LeadStatus = "NEW" | "RESEARCHING" | "READY_OUTREACH" | "APPLIED" | "ARCHIVED";
type LeadSource = "HN" | "REMOTEOK" | "GREENHOUSE" | "GITHUB" | "MANUAL";
type Tab = "openings" | "companies" | "contacts" | "outreach";

interface CompanyIntel {
  id: string;
  type: string;
  title: string;
  url?: string | null;
  summary?: string | null;
  capturedAt: string;
}

interface Contact {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  source: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  company?: { id: string; name: string };
}

interface Company {
  id: string;
  name: string;
  website?: string | null;
  domain?: string | null;
  githubOrg?: string | null;
  industry?: string | null;
  description?: string | null;
  techStack?: string | null;
  headquarters?: string | null;
  lastEnrichedAt?: string | null;
  greenhouseSlug?: string | null;
  leverSlug?: string | null;
  _count?: { jobLeads: number; contacts: number; intel: number };
  newLeadCount?: number;
  intel?: CompanyIntel[];
  contacts?: Contact[];
  jobLeads?: JobLead[];
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
  researchSummary?: string | null;
  status: LeadStatus;
  capturedAt: string;
  company?: Company | null;
}

interface OutreachDraft {
  id: string;
  subject: string;
  body: string;
  status: "DRAFT" | "SENT";
  createdAt: string;
  jobLead?: { id: string; title: string; companyName?: string | null } | null;
  contact?: { id: string; name: string; title?: string | null } | null;
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  HN: "Hacker News",
  REMOTEOK: "RemoteOK",
  GREENHOUSE: "Greenhouse / Lever",
  GITHUB: "GitHub",
  MANUAL: "Manual",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  RESEARCHING: "Researching",
  READY_OUTREACH: "Ready",
  APPLIED: "Applied",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "text-accent border-accent/30 bg-accent/10",
  RESEARCHING: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  READY_OUTREACH: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
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

function parseTechStack(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function LeadsPageClient() {
  const [tab, setTab] = useState<Tab>("openings");
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [stats, setStats] = useState({ totalOpen: 0, newToday: 0, companiesTracked: 0, contactsFound: 0 });
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<JobLead | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [researching, setResearching] = useState(false);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contactCompanyFilter, setContactCompanyFilter] = useState<string>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    const [leadsRes, companiesRes, contactsRes, outreachRes] = await Promise.all([
      fetch("/api/leads").then((r) => r.json()),
      fetch("/api/leads/companies").then((r) => r.json()),
      fetch("/api/leads/contacts").then((r) => r.json()),
      fetch("/api/leads/outreach").then((r) => r.json()),
    ]);

    setLeads(leadsRes.leads ?? []);
    setStats(leadsRes.stats ?? { totalOpen: 0, newToday: 0, companiesTracked: 0, contactsFound: 0 });
    setLastScanAt(leadsRes.lastScanAt ?? null);
    setCompanies(companiesRes.companies ?? []);
    setContacts(contactsRes.contacts ?? []);
    setDrafts(outreachRes.drafts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runScan() {
    setScanning(true);
    setScanError(null);
    setScanMessage(null);
    try {
      const res = await fetch("/api/leads/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      const parts = [`Added ${data.added} leads`, `${data.total} fetched`];
      if (data.errors?.length) parts.push(`${data.errors.length} source warning(s)`);
      setScanMessage(parts.join(" · "));
      if (data.errors?.length) setScanError(data.errors.join("; "));
      await load();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function runEnrichAll() {
    setEnriching(true);
    try {
      await fetch("/api/leads/enrich-all", { method: "POST" });
      await load();
    } finally {
      setEnriching(false);
    }
  }

  async function updateStatus(id: string, status: LeadStatus) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    if (selectedLead?.id === id) setSelectedLead((l) => (l ? { ...l, status } : l));
  }

  async function researchLead(lead: JobLead) {
    setResearching(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/research`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed");
      await load();
      if (data.result?.summary) {
        setSelectedLead((prev) =>
          prev?.id === lead.id
            ? { ...prev, researchSummary: data.result.summary, status: "READY_OUTREACH" }
            : prev
        );
      }
    } finally {
      setResearching(false);
    }
  }

  async function generateOutreach(leadId: string) {
    setGeneratingOutreach(true);
    try {
      const res = await fetch("/api/leads/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobLeadId: leadId }),
      });
      if (res.ok) {
        setTab("outreach");
        await load();
      }
    } finally {
      setGeneratingOutreach(false);
    }
  }

  async function enrichCompany(id: string) {
    const res = await fetch(`/api/leads/companies/${id}`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setSelectedCompany(data.company ?? null);
      await load();
    }
  }

  async function openCompanyProfile(id: string) {
    const res = await fetch(`/api/leads/companies/${id}`);
    const data = await res.json();
    if (data.company) {
      setSelectedCompany(data.company);
      setTab("companies");
    }
  }

  async function markDraftSent(id: string) {
    await fetch("/api/leads/outreach", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "SENT" }),
    });
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status: "SENT" } : d)));
  }

  function copyDraft(draft: OutreachDraft) {
    const text = `Subject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(text);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filteredContacts =
    contactCompanyFilter === "ALL"
      ? contacts
      : contacts.filter((c) => c.company?.id === contactCompanyFilter);

  const tabs: { key: Tab; label: string; icon: typeof Radar }[] = [
    { key: "openings", label: "Openings", icon: Briefcase },
    { key: "companies", label: "Companies", icon: Building2 },
    { key: "contacts", label: "Contacts", icon: Users },
    { key: "outreach", label: "Outreach", icon: Mail },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 lg:p-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Insider Tracker" }]} />
      <PageHeader
        title="Insider Tracker"
        description="Lead intelligence — scan openings, enrich companies, research roles, draft outreach"
        actions={
          <>
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim disabled:opacity-60"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
              Scan for openings
            </button>
            <button
              onClick={runEnrichAll}
              disabled={enriching}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card-hover disabled:opacity-60"
            >
              {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Enrich all
            </button>
          </>
        }
      />

      <p className="text-xs text-muted mb-2">Last scan: {formatRelative(lastScanAt)}</p>
      {scanMessage && <p className="text-xs text-emerald-400 mb-2">{scanMessage}</p>}
      {scanError && (
        <p className="text-xs text-amber-400 mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          {scanError}
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Companies tracked", value: stats.companiesTracked },
          { label: "Open roles", value: stats.totalOpen, accent: true },
          { label: "New today", value: stats.newToday, accent: stats.newToday > 0 },
          { label: "Contacts found", value: stats.contactsFound },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border">
            <p className="text-[10px] text-muted uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.accent ? "text-accent" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-accent/10 text-accent border border-accent/30" : "text-muted hover:bg-card-hover"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : (
        <>
          {tab === "openings" && (
            <div className="space-y-2">
              {leads.length === 0 ? (
                <div className="p-10 rounded-xl border border-dashed border-border text-center">
                  <Radar className="w-10 h-10 mx-auto mb-3 text-muted opacity-50" />
                  <p className="text-sm text-muted mb-3">No openings yet. Run a scan to pull from RemoteOK, Hacker News, GitHub, and ATS boards.</p>
                  <button onClick={runScan} disabled={scanning} className="px-4 py-2 rounded-lg bg-accent text-white text-sm">
                    Scan for openings
                  </button>
                </div>
              ) : (
                leads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="w-full text-left p-4 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{lead.title}</span>
                        {lead.remote && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">Remote</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[lead.status]}`}>
                          {STATUS_LABELS[lead.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {lead.companyName ?? "Unknown company"} · {SOURCE_LABELS[lead.source]} · {formatDate(lead.postedAt ?? lead.capturedAt)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          {tab === "companies" && (
            <div className="grid md:grid-cols-2 gap-3">
              {companies.length === 0 ? (
                <p className="text-sm text-muted col-span-2 p-8 text-center border border-dashed border-border rounded-xl">
                  Companies appear automatically when you scan job openings.
                </p>
              ) : (
                companies.map((co) => (
                  <button
                    key={co.id}
                    onClick={() => openCompanyProfile(co.id)}
                    className="p-4 rounded-xl bg-card border border-border hover:border-accent/30 text-left transition-colors"
                  >
                    <p className="font-semibold text-sm">{co.name}</p>
                    <p className="text-xs text-muted mt-1">
                      {co._count?.jobLeads ?? 0} roles · {co._count?.contacts ?? 0} contacts · enriched {formatRelative(co.lastEnrichedAt)}
                    </p>
                    {co.description && <p className="text-xs text-muted mt-2 line-clamp-2">{co.description}</p>}
                  </button>
                ))
              )}
            </div>
          )}

          {tab === "contacts" && (
            <div>
              <div className="mb-4">
                <select
                  value={contactCompanyFilter}
                  onChange={(e) => setContactCompanyFilter(e.target.value)}
                  className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="ALL">All companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {filteredContacts.length === 0 ? (
                <p className="text-sm text-muted p-8 text-center border border-dashed border-border rounded-xl">
                  No contacts yet. Enrich companies to discover emails and team members.
                </p>
              ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-card border-b border-border">
                      <tr className="text-left text-xs text-muted">
                        <th className="p-3 font-medium">Name</th>
                        <th className="p-3 font-medium">Title</th>
                        <th className="p-3 font-medium">Company</th>
                        <th className="p-3 font-medium">Contact</th>
                        <th className="p-3 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContacts.map((c) => (
                        <tr key={c.id} className="border-b border-border/50 hover:bg-card/50">
                          <td className="p-3 font-medium">{c.name}</td>
                          <td className="p-3 text-muted">{c.title ?? "—"}</td>
                          <td className="p-3 text-muted">{c.company?.name ?? "—"}</td>
                          <td className="p-3">
                            {c.email ? (
                              <a href={`mailto:${c.email}`} className="text-accent hover:underline text-xs">
                                {c.email}
                              </a>
                            ) : c.linkedinUrl ? (
                              <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs">
                                LinkedIn
                              </a>
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                c.confidence === "HIGH"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : c.confidence === "MEDIUM"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-muted/10 text-muted"
                              }`}
                            >
                              {c.confidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "outreach" && (
            <div className="space-y-3">
              {drafts.length === 0 ? (
                <p className="text-sm text-muted p-8 text-center border border-dashed border-border rounded-xl">
                  No outreach drafts yet. Open a lead and click &quot;Generate outreach email&quot;.
                </p>
              ) : (
                drafts.map((draft) => (
                  <div key={draft.id} className="p-4 rounded-xl bg-card border border-border">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-medium text-sm">{draft.subject}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {draft.jobLead?.title ?? "General"} · {draft.jobLead?.companyName ?? ""} · {formatRelative(draft.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border ${
                          draft.status === "SENT" ? "text-emerald-400 border-emerald-400/30" : "text-muted border-border"
                        }`}
                      >
                        {draft.status}
                      </span>
                    </div>
                    <pre className="text-xs text-muted whitespace-pre-wrap font-sans mb-3 max-h-40 overflow-y-auto">{draft.body}</pre>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyDraft(draft)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs hover:bg-card-hover"
                      >
                        {copiedId === draft.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy
                      </button>
                      {draft.status === "DRAFT" && (
                        <button
                          onClick={() => markDraftSent(draft.id)}
                          className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20"
                        >
                          Mark sent
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedLead(null)} />
          <div className="relative w-full max-w-lg bg-background border-l border-border h-full overflow-y-auto p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedLead.title}</h2>
                <p className="text-sm text-muted">{selectedLead.companyName ?? "Unknown company"}</p>
              </div>
              <button onClick={() => setSelectedLead(null)} className="p-2 rounded-lg hover:bg-card-hover">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={selectedLead.status}
                onChange={(e) => updateStatus(selectedLead.id, e.target.value as LeadStatus)}
                className={`text-xs px-2 py-1 rounded-lg border ${STATUS_COLORS[selectedLead.status]}`}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <a
                href={selectedLead.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs hover:bg-card-hover"
              >
                <ExternalLink className="w-3 h-3" /> View posting
              </a>
            </div>

            {selectedLead.description && (
              <div className="mb-4">
                <p className="text-[10px] text-muted uppercase mb-1">Description</p>
                <p className="text-xs whitespace-pre-wrap text-foreground/80 max-h-48 overflow-y-auto">{selectedLead.description}</p>
              </div>
            )}

            {selectedLead.researchSummary ? (
              <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-[10px] text-accent uppercase mb-1 font-semibold">What they want</p>
                <p className="text-xs whitespace-pre-wrap">{selectedLead.researchSummary}</p>
              </div>
            ) : (
              <button
                onClick={() => researchLead(selectedLead)}
                disabled={researching}
                className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-accent/40 text-accent text-sm hover:bg-accent/10 disabled:opacity-60"
              >
                {researching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Research lead
              </button>
            )}

            {selectedLead.company?.intel && selectedLead.company.intel.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-muted uppercase mb-2">Company intel</p>
                <div className="space-y-2">
                  {selectedLead.company.intel.map((i) => (
                    <div key={i.id} className="text-xs p-2 rounded-lg bg-card border border-border">
                      <span className="text-accent font-medium">{i.type.replace("_", " ")}</span> — {i.title}
                      {i.summary && <p className="text-muted mt-1">{i.summary}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedLead.company?.contacts && selectedLead.company.contacts.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-muted uppercase mb-2">Contacts at company</p>
                {selectedLead.company.contacts.map((c) => (
                  <div key={c.id} className="text-xs py-1.5 border-b border-border/50">
                    <span className="font-medium">{c.name}</span>
                    {c.title && <span className="text-muted"> · {c.title}</span>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="block text-accent hover:underline">
                        {c.email}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => generateOutreach(selectedLead.id)}
              disabled={generatingOutreach}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim disabled:opacity-60"
            >
              {generatingOutreach ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Generate outreach email
            </button>
          </div>
        </div>
      )}

      {selectedCompany && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedCompany(null)} />
          <div className="relative w-full max-w-lg bg-background border-l border-border h-full overflow-y-auto p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedCompany.name}</h2>
                {selectedCompany.website && (
                  <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                    {selectedCompany.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              <button onClick={() => setSelectedCompany(null)} className="p-2 rounded-lg hover:bg-card-hover">
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedCompany.description && (
              <p className="text-sm text-muted mb-4">{selectedCompany.description}</p>
            )}

            {parseTechStack(selectedCompany.techStack).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1">
                {parseTechStack(selectedCompany.techStack).map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-card border border-border">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => enrichCompany(selectedCompany.id)}
              className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-accent/40 text-accent text-sm hover:bg-accent/10"
            >
              <RefreshCw className="w-4 h-4" /> Enrich now
            </button>

            {selectedCompany.intel && selectedCompany.intel.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-muted uppercase mb-2">Intel timeline</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedCompany.intel.map((i) => (
                    <div key={i.id} className="text-xs p-2 rounded-lg bg-card border border-border">
                      <span className="text-accent">{i.type}</span> — {i.title}
                      <p className="text-[10px] text-muted mt-0.5">{formatDate(i.capturedAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCompany.jobLeads && selectedCompany.jobLeads.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-muted uppercase mb-2">Open roles ({selectedCompany.jobLeads.length})</p>
                {selectedCompany.jobLeads.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => {
                      setSelectedCompany(null);
                      setSelectedLead(j);
                      setTab("openings");
                    }}
                    className="block w-full text-left text-xs py-2 border-b border-border/50 hover:text-accent"
                  >
                    {j.title}
                  </button>
                ))}
              </div>
            )}

            {selectedCompany.contacts && selectedCompany.contacts.length > 0 && (
              <div>
                <p className="text-[10px] text-muted uppercase mb-2">Contacts ({selectedCompany.contacts.length})</p>
                {selectedCompany.contacts.map((c) => (
                  <div key={c.id} className="text-xs py-1.5 border-b border-border/50">
                    {c.name}{c.title ? ` · ${c.title}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
