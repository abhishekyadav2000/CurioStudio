"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Filter,
  ArrowRight,
  Star,
  Settings2,
  Map,
  Upload,
  ToggleLeft,
  ToggleRight,
  Zap,
  Network,
  Calendar,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/page-header";
import { ROLE_PRESETS } from "@/lib/leads/scoring";
import { InsiderMap, type MapNodeData } from "@/components/insider-map";

const SCROLL_LIST = "rounded-xl border border-border bg-card/30 max-h-[min(520px,60vh)] overflow-y-auto";
const PAGE_SIZE = 25;

type LeadStatus = "NEW" | "RESEARCHING" | "READY_OUTREACH" | "APPLIED" | "ARCHIVED";
type LeadSource =
  | "HN" | "REMOTEOK" | "GREENHOUSE" | "GITHUB" | "MANUAL" | "FORTUNE_CAREERS"
  | "WELLFOUND" | "WWR" | "BUILTIN" | "INDEED" | "LINKEDIN" | "ASHBY" | "LEVER";
type Tab = "shortlist" | "openings" | "companies" | "contacts" | "map" | "outreach-prep" | "preferences" | "roadmap" | "outreach";

interface JobPreferences {
  targetRoles: string[];
  keywords: string[];
  locations: string[];
  remoteOnly: boolean;
  excludeCompanies: string[];
  preferencesSet?: boolean;
}

interface ScanSettings {
  leadsAutoScanIntervalMinutes: number;
  leadsMaxAgeDays: number;
  leadsAutoScanEnabled: boolean;
}

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
  reportsToId?: string | null;
  company?: { id: string; name: string; _count?: { jobLeads: number } };
}

interface Company {
  id: string;
  name: string;
  website?: string | null;
  careersUrl?: string | null;
  domain?: string | null;
  githubOrg?: string | null;
  industry?: string | null;
  description?: string | null;
  techStack?: string | null;
  headquarters?: string | null;
  lastEnrichedAt?: string | null;
  greenhouseSlug?: string | null;
  leverSlug?: string | null;
  linkedinSearchUrl?: string | null;
  freshRoleCount?: number;
  avgRelevance?: number;
  isFortune100?: boolean;
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
  actualPostedAt?: string | null;
  verifiedAt?: string | null;
  isAlive?: boolean | null;
  description?: string | null;
  researchSummary?: string | null;
  relevanceScore?: number;
  isFortune100?: boolean;
  status: LeadStatus;
  capturedAt: string;
  company?: Company | null;
}

interface OutreachBatch {
  id: string;
  name: string;
  status: string;
  scheduledFor?: string | null;
  meetingDate?: string | null;
  meetingAttendees?: string[];
  notes?: string | null;
  projectId?: string | null;
  items: {
    contactId?: string;
    leadId?: string;
    contactName?: string;
    contactEmail?: string;
    contactTitle?: string;
    companyName?: string;
    roleTitle?: string;
    talkingPoints: string[];
  }[];
  createdAt: string;
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

interface RoadmapItem {
  id: number;
  phase: number;
  title: string;
}

interface RoadmapPhase {
  phase: number;
  items: RoadmapItem[];
  completed: number;
  total: number;
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  HN: "Hacker News", REMOTEOK: "RemoteOK", GREENHOUSE: "Greenhouse", GITHUB: "GitHub",
  MANUAL: "Manual", FORTUNE_CAREERS: "Fortune / Top Cos", WELLFOUND: "Wellfound",
  WWR: "We Work Remotely", BUILTIN: "Built In", INDEED: "Indeed", LINKEDIN: "LinkedIn",
  ASHBY: "Ashby", LEVER: "Lever",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New", RESEARCHING: "Researching", READY_OUTREACH: "Ready", APPLIED: "Applied", ARCHIVED: "Archived",
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

function freshnessBadge(iso?: string | null, actualIso?: string | null) {
  const dateIso = actualIso ?? iso;
  if (!dateIso) return { label: "Unknown", cls: "bg-muted/10 text-muted" };
  const days = (Date.now() - new Date(dateIso).getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 7) return { label: `${Math.max(1, Math.round(days))}d ago`, cls: "bg-emerald-500/10 text-emerald-400" };
  if (days <= 30) return { label: `${Math.round(days)}d ago`, cls: "bg-amber-500/10 text-amber-400" };
  return { label: `${Math.round(days)}d+`, cls: "bg-red-500/10 text-red-400" };
}

function verifyBadge(lead: JobLead) {
  if (lead.isAlive === false) return { label: "Link dead ✗", cls: "bg-red-500/10 text-red-400" };
  if (lead.verifiedAt) return { label: "Verified ✓", cls: "bg-emerald-500/10 text-emerald-400" };
  return null;
}

function parseTechStack(raw?: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

interface LeadsPageClientProps {
  initialTab?: Tab;
}

export function LeadsPageClient({ initialTab = "shortlist" }: LeadsPageClientProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [leads, setLeads] = useState<JobLead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [stats, setStats] = useState({ totalOpen: 0, newToday: 0, companiesTracked: 0, contactsFound: 0 });
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [scanSettings, setScanSettings] = useState<ScanSettings>({ leadsAutoScanIntervalMinutes: 5, leadsMaxAgeDays: 45, leadsAutoScanEnabled: true });
  const [preferences, setPreferences] = useState<JobPreferences>({ targetRoles: [], keywords: [], locations: [], remoteOnly: false, excludeCompanies: [] });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, number> | null>(null);
  const [selectedLead, setSelectedLead] = useState<JobLead | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [researching, setResearching] = useState(false);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contactCompanyFilter, setContactCompanyFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "ALL">("ALL");
  const [minRelevance, setMinRelevance] = useState(0);
  const [postedWithin, setPostedWithin] = useState(30);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [fortune100Filter, setFortune100Filter] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [prefsDraft, setPrefsDraft] = useState<JobPreferences>({ targetRoles: [], keywords: [], locations: [], remoteOnly: false, excludeCompanies: [] });
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [roadmapPhases, setRoadmapPhases] = useState<RoadmapPhase[]>([]);
  const [roadmapProgress, setRoadmapProgress] = useState<Record<string, boolean>>({});
  const [fortune100Companies, setFortune100Companies] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [outreachBatches, setOutreachBatches] = useState<OutreachBatch[]>([]);
  const [batchName, setBatchName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingAttendees, setMeetingAttendees] = useState("");
  const [mapSelected, setMapSelected] = useState<MapNodeData | null>(null);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0);

  const buildLeadsQuery = useCallback(
    (shortlist: boolean) => {
      const params = new URLSearchParams();
      params.set("limit", shortlist ? "50" : "200");
      if (shortlist) params.set("shortlist", "true");
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (minRelevance > 0) params.set("minRelevance", String(minRelevance));
      if (postedWithin > 0) params.set("postedWithin", String(postedWithin));
      if (remoteOnly) params.set("remoteOnly", "true");
      if (fortune100Filter) params.set("fortune100", "true");
      if (selectedRoles.length) params.set("roles", selectedRoles.join(","));
      return params.toString();
    },
    [sourceFilter, minRelevance, postedWithin, remoteOnly, fortune100Filter, selectedRoles]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const isShortlist = tab === "shortlist";
    const query = buildLeadsQuery(isShortlist);
    const [leadsRes, companiesRes, contactsRes, outreachRes, prefsRes, roadmapRes, batchesRes] = await Promise.all([
      fetch(`/api/leads?${query}`).then((r) => r.json()),
      fetch(`/api/leads/companies${fortune100Companies ? "?fortune100=true" : ""}`).then((r) => r.json()),
      fetch("/api/leads/contacts").then((r) => r.json()),
      fetch("/api/leads/outreach").then((r) => r.json()),
      fetch("/api/leads/preferences").then((r) => r.json()),
      fetch("/api/leads/roadmap").then((r) => r.json()),
      fetch("/api/leads/outreach-batches").then((r) => r.json()),
    ]);

    setLeads(leadsRes.leads ?? []);
    setStats(leadsRes.stats ?? { totalOpen: 0, newToday: 0, companiesTracked: 0, contactsFound: 0 });
    setLastScanAt(leadsRes.lastScanAt ?? null);
    if (leadsRes.scanSettings) setScanSettings(leadsRes.scanSettings);
    if (leadsRes.preferences) setPreferences(leadsRes.preferences);
    setCompanies(companiesRes.companies ?? []);
    setContacts(contactsRes.contacts ?? []);
    setDrafts(outreachRes.drafts ?? []);
    if (prefsRes.preferences) {
      setPreferences(prefsRes.preferences);
      setPrefsDraft(prefsRes.preferences);
      setKeywordInput(prefsRes.preferences.keywords?.join(", ") ?? "");
      setLocationInput(prefsRes.preferences.locations?.join(", ") ?? "");
      if (!prefsRes.preferences.preferencesSet) setShowPrefsModal(true);
    }
    if (roadmapRes.phases) setRoadmapPhases(roadmapRes.phases);
    if (roadmapRes.progress) setRoadmapProgress(roadmapRes.progress);
    setOutreachBatches(batchesRes.batches ?? []);
    setLoading(false);
  }, [tab, buildLeadsQuery, fortune100Companies]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    load();
  }, [load]);

  const runScan = useCallback(async (silent = false) => {
    if (scanning) return;
    if (!silent) setScanning(true);
    setScanError(null);
    if (!silent) setScanMessage(null);
    try {
      const res = await fetch("/api/leads/cron");
      const data = await res.json();
      if (res.status === 429) {
        if (!silent) setScanError(`Rate limited — retry in ${Math.ceil((data.retryAfterMs ?? 10000) / 1000)}s`);
        return;
      }
      if (data.skipped && data.reason === "Auto-scan disabled") return;
      if (!res.ok && data.error) throw new Error(data.error);

      if (data.message || data.added !== undefined) {
        const msg = data.message ?? `Added ${data.added} · Pruned ${data.pruned ?? 0} stale`;
        if (!silent) setScanMessage(msg);
        if (data.bySource) setSourceBreakdown(data.bySource);
        if (data.errors?.length) setScanError(data.errors.join("; "));
      }
      await load();
    } catch (err) {
      if (!silent) setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      if (!silent) setScanning(false);
    }
  }, [scanning, load]);

  useEffect(() => {
    if (scanSettings.leadsAutoScanEnabled) {
      runScan(true);
      scanIntervalRef.current = setInterval(
        () => runScan(true),
        scanSettings.leadsAutoScanIntervalMinutes * 60 * 1000
      );
    }
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [scanSettings.leadsAutoScanEnabled, scanSettings.leadsAutoScanIntervalMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const nextScanIn = useMemo(() => {
    if (!lastScanAt || !scanSettings.leadsAutoScanEnabled) return null;
    const elapsed = Date.now() - new Date(lastScanAt).getTime();
    const remaining = scanSettings.leadsAutoScanIntervalMinutes * 60 * 1000 - elapsed;
    if (remaining <= 0) return "soon";
    return `${Math.ceil(remaining / 60000)}m`;
  }, [lastScanAt, scanSettings]);

  async function runEnrichAll() {
    setEnriching(true);
    try {
      await fetch("/api/leads/enrich-all", { method: "POST" });
      await load();
    } finally {
      setEnriching(false);
    }
  }

  async function savePreferences() {
    setPrefsMessage(null);
    try {
      const res = await fetch("/api/leads/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { ...prefsDraft, preferencesSet: true } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const saved = data.preferences ?? prefsDraft;
      setPreferences(saved);
      setPrefsDraft(saved);
      setPrefsMessage("Preferences saved");
      setShowPrefsModal(false);
      await load();
    } catch (err) {
      setPrefsMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function savePreferencesFromTab() {
    setPrefsMessage(null);
    try {
      const res = await fetch("/api/leads/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { ...prefsDraft, preferencesSet: true } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const saved = data.preferences ?? prefsDraft;
      setPreferences(saved);
      setPrefsDraft(saved);
      setPrefsMessage("Preferences saved");
      await load();
    } catch (err) {
      setPrefsMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function uploadResume(file: File) {
    setUploadingResume(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/leads/resume", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.preferences) {
        setPrefsDraft(data.preferences);
        setPreferences(data.preferences);
      }
    } finally {
      setUploadingResume(false);
    }
  }

  async function toggleRoadmapItem(id: number, completed: boolean) {
    await fetch("/api/leads/roadmap", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: id, completed }),
    });
    setRoadmapProgress((p) => ({ ...p, [String(id)]: completed }));
  }

  async function updateStatus(id: string, status: LeadStatus) {
    await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
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
        setSelectedLead((prev) => prev?.id === lead.id ? { ...prev, researchSummary: data.result.summary, status: "READY_OUTREACH" } : prev);
      }
    } finally {
      setResearching(false);
    }
  }

  async function generateOutreach(leadId: string) {
    setGeneratingOutreach(true);
    try {
      const res = await fetch("/api/leads/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobLeadId: leadId }) });
      if (res.ok) { setTab("outreach"); await load(); }
    } finally {
      setGeneratingOutreach(false);
    }
  }

  async function enrichCompany(id: string) {
    const res = await fetch(`/api/leads/companies/${id}`, { method: "POST" });
    if (res.ok) { const data = await res.json(); setSelectedCompany(data.company ?? null); await load(); }
  }

  async function openCompanyProfile(id: string) {
    const res = await fetch(`/api/leads/companies/${id}`);
    const data = await res.json();
    if (data.company) { setSelectedCompany(data.company); setTab("companies"); }
  }

  async function markDraftSent(id: string) {
    await fetch("/api/leads/outreach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "SENT" }) });
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status: "SENT" } : d)));
  }

  function copyDraft(draft: OutreachDraft) {
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function toggleLeadSelection(id: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleContactSelection(id: string) {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createOutreachBatch() {
    if (!batchName.trim()) return;
    setCreatingBatch(true);
    try {
      const res = await fetch("/api/leads/outreach-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: batchName.trim(),
          contactIds: [...selectedContactIds],
          leadIds: [...selectedLeadIds],
          meetingDate: meetingDate || undefined,
          meetingAttendees: meetingAttendees
            ? meetingAttendees.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create batch");
      setBatchName("");
      setMeetingDate("");
      setMeetingAttendees("");
      setSelectedLeadIds(new Set());
      setSelectedContactIds(new Set());
      setTab("outreach-prep");
      await load();
    } finally {
      setCreatingBatch(false);
    }
  }

  async function createContentForBatch(batchId: string) {
    const res = await fetch("/api/leads/outreach-batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createContent", batchId }),
    });
    const data = await res.json();
    if (res.ok && data.projectId) {
      window.location.href = `/studio/${data.projectId}`;
    }
  }

  function copyBatchEmails(batch: OutreachBatch) {
    const emails = batch.items.map((i) => i.contactEmail).filter(Boolean).join(", ");
    if (emails) navigator.clipboard.writeText(emails);
  }

  function toggleRolePreset(role: string) {
    setPrefsDraft((p) => ({
      ...p,
      targetRoles: p.targetRoles.includes(role) ? p.targetRoles.filter((r) => r !== role) : [...p.targetRoles, role],
    }));
  }

  const filteredContacts = contactCompanyFilter === "ALL" ? contacts : contacts.filter((c) => c.company?.id === contactCompanyFilter);
  const visibleLeads = leads.slice(0, visibleCount);
  const hasMoreLeads = visibleCount < leads.length;

  const sourceOptions = useMemo(() => {
    const counts = leads.reduce<Record<string, number>>((acc, l) => { acc[l.source] = (acc[l.source] ?? 0) + 1; return acc; }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const tabs: { key: Tab; label: string; icon: typeof Radar }[] = [
    { key: "shortlist", label: "Shortlist", icon: Star },
    { key: "openings", label: "All Openings", icon: Briefcase },
    { key: "companies", label: "Companies", icon: Building2 },
    { key: "contacts", label: "Contacts", icon: Users },
    { key: "map", label: "Insider Map", icon: Network },
    { key: "outreach-prep", label: "Outreach Prep", icon: Calendar },
    { key: "preferences", label: "Preferences", icon: Settings2 },
    { key: "roadmap", label: "Roadmap", icon: Map },
    { key: "outreach", label: "Outreach", icon: Mail },
  ];

  function LeadRow({ lead }: { lead: JobLead }) {
    const fresh = freshnessBadge(lead.postedAt ?? lead.capturedAt, lead.actualPostedAt);
    const verified = verifyBadge(lead);
    const selected = selectedLeadIds.has(lead.id);
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleLeadSelection(lead.id)}
          className="shrink-0 ml-1"
          title="Add to outreach batch"
        />
        <button
          key={lead.id}
          onClick={() => setSelectedLead(lead)}
          className="flex-1 text-left p-3 rounded-xl bg-card border border-border hover:border-accent/30 transition-colors flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{lead.title}</span>
              {lead.relevanceScore != null && lead.relevanceScore > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold">{lead.relevanceScore}</span>
              )}
              {lead.remote && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">Remote</span>}
              {lead.isFortune100 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">F100</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${fresh.cls}`}>{fresh.label}</span>
              {verified && <span className={`text-[10px] px-1.5 py-0.5 rounded ${verified.cls}`}>{verified.label}</span>}
            </div>
            <p className="text-xs text-muted mt-0.5 truncate">
              {lead.companyName ?? "Unknown"} · {SOURCE_LABELS[lead.source]} · {formatDate(lead.actualPostedAt ?? lead.postedAt ?? lead.capturedAt)}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        </button>
      </div>
    );
  }

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0">
      <Filter className="w-3.5 h-3.5 text-muted" />
      <label className="text-xs text-muted flex items-center gap-1">
        Min score
        <input type="range" min={0} max={100} value={minRelevance} onChange={(e) => setMinRelevance(parseInt(e.target.value, 10))} className="w-20" />
        <span className="w-6">{minRelevance}</span>
      </label>
      <select value={postedWithin} onChange={(e) => setPostedWithin(parseInt(e.target.value, 10))} className="bg-card border border-border rounded-lg px-2 py-1 text-xs">
        <option value={0}>Any age</option>
        <option value={7}>7 days</option>
        <option value={30}>30 days</option>
        <option value={45}>45 days</option>
      </select>
      <label className="text-xs flex items-center gap-1 cursor-pointer">
        <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote
      </label>
      <label className="text-xs flex items-center gap-1 cursor-pointer">
        <input type="checkbox" checked={fortune100Filter} onChange={(e) => setFortune100Filter(e.target.checked)} /> Fortune 100
      </label>
      <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as LeadSource | "ALL")} className="bg-card border border-border rounded-lg px-2 py-1 text-xs">
        <option value="ALL">All sources</option>
        {sourceOptions.map(([src, n]) => (
          <option key={src} value={src}>{SOURCE_LABELS[src as LeadSource] ?? src} ({n})</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto p-4 lg:p-6">
      <div className="shrink-0">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Insider Tracker" }]} />
        <PageHeader
          title="Insider Tracker"
          description="Fresh roles from top 100 companies — scored to your preferences, auto-scanned every few minutes"
          actions={
            <>
              <button
                onClick={() => runScan(false)}
                disabled={scanning}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card-hover disabled:opacity-60"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                Scan now
              </button>
              <button
                onClick={runEnrichAll}
                disabled={enriching}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-card-hover disabled:opacity-60"
              >
                {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Enrich
              </button>
            </>
          }
        />

        <div className="mb-3 p-2.5 rounded-lg bg-accent/5 border border-accent/20 flex items-center gap-2 text-xs text-muted">
          <Zap className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>
            {scanSettings.leadsAutoScanEnabled ? (
              <>Auto-scan every {scanSettings.leadsAutoScanIntervalMinutes}m · max age {scanSettings.leadsMaxAgeDays}d · </>
            ) : (
              <>Auto-scan off · </>
            )}
            Last scan: {formatRelative(lastScanAt)}
            {nextScanIn && <> · Next: {nextScanIn}</>}
          </span>
          <button
            onClick={async () => {
              const next = !scanSettings.leadsAutoScanEnabled;
              await fetch("/api/leads/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadsAutoScanEnabled: next }) });
              setScanSettings((s) => ({ ...s, leadsAutoScanEnabled: next }));
            }}
            className="ml-auto shrink-0"
            title="Toggle auto-scan"
          >
            {scanSettings.leadsAutoScanEnabled ? <ToggleRight className="w-5 h-5 text-accent" /> : <ToggleLeft className="w-5 h-5 text-muted" />}
          </button>
        </div>

        {scanMessage && <p className="text-xs text-emerald-400 mb-2">{scanMessage}</p>}
        {sourceBreakdown && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([src, n]) => (
              <span key={src} className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border">
                {SOURCE_LABELS[src as LeadSource] ?? src}: <strong>{n}</strong>
              </span>
            ))}
          </div>
        )}
        {scanError && <p className="text-xs text-amber-400 mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">{scanError}</p>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          {[
            { label: "Companies tracked", value: stats.companiesTracked },
            { label: "Fresh open roles", value: stats.totalOpen, accent: true },
            { label: "New today", value: stats.newToday, accent: stats.newToday > 0 },
            { label: "Contacts found", value: stats.contactsFound },
          ].map((s) => (
            <div key={s.label} className="p-2.5 rounded-xl bg-card border border-border">
              <p className="text-[10px] text-muted uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.accent ? "text-accent" : ""}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-3 border-b border-border pb-3">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? "bg-accent/10 text-accent border border-accent/30" : "text-muted hover:bg-card-hover"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : (
          <>
            {(tab === "shortlist" || tab === "openings") && (
              <div className="flex flex-col min-h-0 flex-1">
                {filterBar}
                {tab === "shortlist" && (
                  <p className="text-xs text-muted mb-2">Fresh verified roles (30d, score ≥40) · {selectedLeadIds.size} selected for outreach</p>
                )}
                {(tab === "shortlist" || tab === "openings") && (selectedLeadIds.size > 0 || selectedContactIds.size > 0) && (
                  <div className="flex flex-wrap items-center gap-2 mb-2 p-2 rounded-lg bg-accent/5 border border-accent/20">
                    <input
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Outreach batch name..."
                      className="flex-1 min-w-[160px] bg-card border border-border rounded-lg px-2 py-1 text-xs"
                    />
                    <button
                      onClick={createOutreachBatch}
                      disabled={creatingBatch || !batchName.trim()}
                      className="px-3 py-1 rounded-lg bg-accent text-white text-xs disabled:opacity-50"
                    >
                      {creatingBatch ? "Creating..." : `Add to batch (${selectedLeadIds.size + selectedContactIds.size})`}
                    </button>
                  </div>
                )}
                {leads.length === 0 ? (
                  <div className="p-10 rounded-xl border border-dashed border-border text-center shrink-0">
                    <Star className="w-10 h-10 mx-auto mb-3 text-muted opacity-50" />
                    <p className="text-sm text-muted mb-3">No matching openings. Set preferences or wait for the next auto-scan.</p>
                    <button onClick={() => setShowPrefsModal(true)} className="px-4 py-2 rounded-lg bg-accent text-white text-sm">Set preferences</button>
                  </div>
                ) : (
                  <>
                    <div className={`${SCROLL_LIST} flex-1 min-h-0`}>
                      <div className="space-y-1.5 p-2">{visibleLeads.map((lead) => <LeadRow key={lead.id} lead={lead} />)}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted shrink-0">
                      <span>Showing {visibleLeads.length} of {leads.length}</span>
                      {hasMoreLeads && (
                        <button onClick={() => setVisibleCount((n) => n + PAGE_SIZE)} className="px-3 py-1.5 rounded-lg border border-border hover:bg-card-hover text-sm text-foreground">Load more</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "companies" && (
              <div className="flex flex-col min-h-0 flex-1">
                <label className="text-xs flex items-center gap-2 mb-2 shrink-0 cursor-pointer">
                  <input type="checkbox" checked={fortune100Companies} onChange={(e) => setFortune100Companies(e.target.checked)} />
                  Top 100 companies only
                </label>
                <div className={`${SCROLL_LIST} flex-1 min-h-0`}>
                  <div className="grid md:grid-cols-2 gap-2 p-2">
                    {companies.length === 0 ? (
                      <p className="text-sm text-muted col-span-2 p-8 text-center">Companies appear when you scan job openings.</p>
                    ) : (
                      companies.map((co) => (
                        <button key={co.id} onClick={() => openCompanyProfile(co.id)} className="p-3 rounded-xl bg-card border border-border hover:border-accent/30 text-left transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-sm">{co.name}</p>
                            <div className="flex gap-1 shrink-0">
                              {co.isFortune100 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">F100</span>}
                              {co.lastEnrichedAt ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Enriched</span> : <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/10 text-muted">Pending</span>}
                            </div>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            {co.freshRoleCount ?? co._count?.jobLeads ?? 0} fresh roles
                            {co.avgRelevance ? ` · avg score ${co.avgRelevance}` : ""}
                            · {co._count?.contacts ?? 0} contacts
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === "contacts" && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="mb-2 shrink-0">
                  <select value={contactCompanyFilter} onChange={(e) => setContactCompanyFilter(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs">
                    <option value="ALL">All companies</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {filteredContacts.length === 0 ? (
                  <p className="text-sm text-muted p-8 text-center border border-dashed border-border rounded-xl">No contacts yet. Enrich companies to discover emails.</p>
                ) : (
                  <div className={`${SCROLL_LIST} flex-1 min-h-0 overflow-x-auto`}>
                    <table className="w-full text-sm">
                      <thead className="bg-card border-b border-border sticky top-0">
                        <tr className="text-left text-xs text-muted">
                          <th className="p-2 font-medium w-8" />
                          <th className="p-2 font-medium">Name</th>
                          <th className="p-2 font-medium">Title</th>
                          <th className="p-2 font-medium">Company</th>
                          <th className="p-2 font-medium">Contact</th>
                          <th className="p-2 font-medium">Conf.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContacts.map((c) => (
                          <tr key={c.id} className="border-b border-border/50 hover:bg-card/50">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedContactIds.has(c.id)}
                                onChange={() => toggleContactSelection(c.id)}
                              />
                            </td>
                            <td className="p-2 font-medium">{c.name}</td>
                            <td className="p-2 text-muted">{c.title ?? "—"}</td>
                            <td className="p-2 text-muted">{c.company?.name ?? "—"}</td>
                            <td className="p-2">
                              {c.email ? <a href={`mailto:${c.email}`} className="text-accent hover:underline text-xs">{c.email}</a>
                                : c.linkedinUrl ? <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs">LinkedIn</a>
                                : <span className="text-muted text-xs">—</span>}
                            </td>
                            <td className="p-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                c.confidence === "HIGH" ? "bg-emerald-500/10 text-emerald-400"
                                  : c.confidence === "MEDIUM" ? "bg-amber-500/10 text-amber-400" : "bg-muted/10 text-muted"
                              }`}>{c.confidence}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "map" && (
              <div className="flex flex-col min-h-0 flex-1 gap-3">
                <InsiderMap onSelectNode={setMapSelected} />
                {mapSelected && (
                  <div className="p-3 rounded-xl bg-card border border-border shrink-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{mapSelected.label}</p>
                        <p className="text-xs text-muted">{mapSelected.title ?? mapSelected.nodeType}</p>
                        {mapSelected.email && <p className="text-xs text-accent">{mapSelected.email}</p>}
                      </div>
                      <button onClick={() => setMapSelected(null)} className="p-1 rounded hover:bg-card-hover"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {mapSelected.leadId && (
                        <button
                          onClick={() => {
                            const lead = leads.find((l) => l.id === mapSelected.leadId);
                            if (lead) setSelectedLead(lead);
                          }}
                          className="px-2 py-1 rounded-lg border border-border text-xs hover:bg-card-hover"
                        >
                          View role
                        </button>
                      )}
                      {mapSelected.companyId && (
                        <button onClick={() => openCompanyProfile(mapSelected.companyId!)} className="px-2 py-1 rounded-lg border border-border text-xs hover:bg-card-hover">
                          Company
                        </button>
                      )}
                      {mapSelected.contactId && (
                        <button
                          onClick={() => {
                            toggleContactSelection(mapSelected.contactId!);
                            setTab("outreach-prep");
                          }}
                          className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs"
                        >
                          Add to outreach
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "outreach-prep" && (
              <div className={`${SCROLL_LIST} flex-1 min-h-0`}>
                <div className="p-4 space-y-4">
                  <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                    <p className="text-sm font-medium">Create outreach batch</p>
                    <input
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="Batch name (e.g. Tomorrow's meetings)"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="datetime-local"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      value={meetingAttendees}
                      onChange={(e) => setMeetingAttendees(e.target.value)}
                      placeholder="Meeting attendees (comma-separated emails)"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted">
                      Selected: {selectedLeadIds.size} leads, {selectedContactIds.size} contacts
                    </p>
                    <button
                      onClick={createOutreachBatch}
                      disabled={creatingBatch || !batchName.trim()}
                      className="px-4 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-50"
                    >
                      {creatingBatch ? "Creating..." : "Create outreach batch"}
                    </button>
                  </div>

                  {outreachBatches.length === 0 ? (
                    <p className="text-sm text-muted text-center py-8">No outreach batches yet. Select leads/contacts and create a batch.</p>
                  ) : (
                    outreachBatches.map((batch) => (
                      <div key={batch.id} className="p-4 rounded-xl bg-card border border-border">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-medium text-sm">{batch.name}</p>
                            <p className="text-xs text-muted">{batch.status} · {batch.items.length} targets</p>
                            {batch.meetingDate && <p className="text-xs text-muted">Meeting: {formatDate(batch.meetingDate)}</p>}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => copyBatchEmails(batch)} className="px-2 py-1 rounded-lg border border-border text-xs">Copy emails</button>
                            <button onClick={() => createContentForBatch(batch.id)} className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs">Create content</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {batch.items.map((item, i) => (
                            <div key={i} className="p-2 rounded-lg bg-background border border-border/50 text-xs">
                              <p className="font-medium">{item.contactName ?? item.roleTitle} @ {item.companyName}</p>
                              {item.contactEmail && <p className="text-accent">{item.contactEmail}</p>}
                              <ul className="mt-1 text-muted list-disc list-inside">
                                {item.talkingPoints.slice(0, 3).map((tp, j) => <li key={j}>{tp}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === "preferences" && (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-2">
                {prefsMessage && (
                  <p className={`text-xs p-2 rounded-lg ${prefsMessage.includes("saved") ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {prefsMessage}
                  </p>
                )}
                <PreferencesForm
                  prefs={prefsDraft}
                  onChange={setPrefsDraft}
                  keywordInput={keywordInput}
                  setKeywordInput={setKeywordInput}
                  locationInput={locationInput}
                  setLocationInput={setLocationInput}
                  onSave={savePreferencesFromTab}
                  onUpload={uploadResume}
                  uploading={uploadingResume}
                  showPresets
                  toggleRole={toggleRolePreset}
                />
              </div>
            )}

            {tab === "roadmap" && (
              <div className={`${SCROLL_LIST} flex-1 min-h-0`}>
                <div className="p-4 space-y-6">
                  <p className="text-sm text-muted">100-item roadmap toward auto-apply. See <code className="text-xs bg-card px-1 rounded">docs/INSIDER_TRACKER_ROADMAP.md</code></p>
                  {roadmapPhases.map((phase) => (
                    <div key={phase.phase}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">Phase {phase.phase}</h3>
                        <span className="text-xs text-muted">{phase.completed}/{phase.total} complete</span>
                      </div>
                      <div className="w-full h-1.5 bg-card rounded-full mb-3">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${phase.total ? (phase.completed / phase.total) * 100 : 0}%` }} />
                      </div>
                      <div className="space-y-1">
                        {phase.items.map((item) => (
                          <label key={item.id} className="flex items-start gap-2 text-xs p-2 rounded-lg hover:bg-card/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={roadmapProgress[String(item.id)] ?? (item.id <= 30)}
                              onChange={(e) => toggleRoadmapItem(item.id, e.target.checked)}
                              className="mt-0.5"
                            />
                            <span><span className="text-muted">{item.id}.</span> {item.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "outreach" && (
              <div className={`${SCROLL_LIST} flex-1 min-h-0`}>
                <div className="space-y-2 p-2">
                  {drafts.length === 0 ? (
                    <p className="text-sm text-muted p-8 text-center">No outreach drafts yet. Open a lead and generate outreach.</p>
                  ) : (
                    drafts.map((draft) => (
                      <div key={draft.id} className="p-3 rounded-xl bg-card border border-border">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-medium text-sm">{draft.subject}</p>
                            <p className="text-xs text-muted mt-0.5">{draft.jobLead?.title ?? "General"} · {formatRelative(draft.createdAt)}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${draft.status === "SENT" ? "text-emerald-400 border-emerald-400/30" : "text-muted border-border"}`}>{draft.status}</span>
                        </div>
                        <pre className="text-xs text-muted whitespace-pre-wrap font-sans mb-2 max-h-32 overflow-y-auto">{draft.body}</pre>
                        <div className="flex gap-2">
                          <button onClick={() => copyDraft(draft)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-xs hover:bg-card-hover">
                            {copiedId === draft.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                          </button>
                          {draft.status === "DRAFT" && (
                            <button onClick={() => markDraftSent(draft.id)} className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20">Mark sent</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showPrefsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPrefsModal(false)} />
          <div className="relative w-full max-w-lg bg-background border border-border rounded-xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-1">What are you looking for?</h2>
            <p className="text-sm text-muted mb-4">We&apos;ll score and shortlist roles that match — no scrolling through 9000 stale listings.</p>
            <PreferencesForm
              prefs={prefsDraft}
              onChange={setPrefsDraft}
              keywordInput={keywordInput}
              setKeywordInput={setKeywordInput}
              locationInput={locationInput}
              setLocationInput={setLocationInput}
              onUpload={uploadResume}
              uploading={uploadingResume}
              showPresets
              toggleRole={toggleRolePreset}
            />
            <div className="flex gap-2 mt-4">
              {prefsMessage && (
                <p className={`text-xs mb-2 w-full ${prefsMessage.includes("saved") ? "text-emerald-400" : "text-red-400"}`}>{prefsMessage}</p>
              )}
              <button onClick={savePreferences} className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium">Save preferences</button>
              <button onClick={() => setShowPrefsModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Skip</button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={updateStatus}
          onResearch={() => researchLead(selectedLead)}
          researching={researching}
          onOutreach={() => generateOutreach(selectedLead.id)}
          generatingOutreach={generatingOutreach}
        />
      )}

      {selectedCompany && (
        <CompanyDetailPanel
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onEnrich={() => enrichCompany(selectedCompany.id)}
          onSelectLead={(j) => { setSelectedCompany(null); setSelectedLead(j); setTab("openings"); }}
        />
      )}
    </div>
  );
}

function PreferencesForm({
  prefs,
  onChange,
  keywordInput,
  setKeywordInput,
  locationInput,
  setLocationInput,
  onSave,
  onUpload,
  uploading,
  showPresets,
  toggleRole,
}: {
  prefs: JobPreferences;
  onChange: (p: JobPreferences) => void;
  keywordInput: string;
  setKeywordInput: (s: string) => void;
  locationInput: string;
  setLocationInput: (s: string) => void;
  onSave?: () => void;
  onUpload: (f: File) => void;
  uploading: boolean;
  showPresets?: boolean;
  toggleRole?: (role: string) => void;
}) {
  return (
    <div className="space-y-4">
      {showPresets && (
        <div>
          <p className="text-xs text-muted uppercase mb-2">Target roles</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_PRESETS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole?.(role)}
                className={`text-xs px-2 py-1 rounded-lg border ${prefs.targetRoles.includes(role) ? "bg-accent/10 text-accent border-accent/30" : "border-border hover:bg-card-hover"}`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      )}
      {!showPresets && prefs.targetRoles.length > 0 && (
        <div className="flex flex-wrap gap-1">{prefs.targetRoles.map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{r}</span>)}</div>
      )}
      <div>
        <p className="text-xs text-muted uppercase mb-1">Keywords / skills</p>
        <textarea
          value={keywordInput || prefs.keywords.join(", ")}
          onChange={(e) => {
            setKeywordInput(e.target.value);
            onChange({ ...prefs, keywords: e.target.value.split(/[,;\n]/).map((k) => k.trim()).filter(Boolean) });
          }}
          placeholder="React, Python, Kubernetes, system design..."
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm min-h-[80px]"
        />
      </div>
      <div>
        <p className="text-xs text-muted uppercase mb-1">Locations</p>
        <input
          value={locationInput || prefs.locations.join(", ")}
          onChange={(e) => {
            setLocationInput(e.target.value);
            onChange({ ...prefs, locations: e.target.value.split(/[,;]/).map((l) => l.trim()).filter(Boolean) });
          }}
          placeholder="San Francisco, New York, Remote"
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={prefs.remoteOnly} onChange={(e) => onChange({ ...prefs, remoteOnly: e.target.checked })} />
        Remote only
      </label>
      <div>
        <p className="text-xs text-muted uppercase mb-2">Resume upload</p>
        <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border cursor-pointer hover:bg-card-hover">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span className="text-sm">Upload .txt or .pdf to extract keywords</span>
          <input type="file" accept=".txt,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
        </label>
      </div>
      {onSave && (
        <button onClick={onSave} className="px-4 py-2 rounded-lg bg-accent text-white text-sm">Save preferences</button>
      )}
    </div>
  );
}

function LeadDetailPanel({
  lead, onClose, onStatusChange, onResearch, researching, onOutreach, generatingOutreach,
}: {
  lead: JobLead; onClose: () => void; onStatusChange: (id: string, s: LeadStatus) => void;
  onResearch: () => void; researching: boolean; onOutreach: () => void; generatingOutreach: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background border-l border-border h-full overflow-y-auto p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{lead.title}</h2>
            <p className="text-sm text-muted">{lead.companyName ?? "Unknown"} · Score {lead.relevanceScore ?? 0}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-card-hover"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <select value={lead.status} onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)} className={`text-xs px-2 py-1 rounded-lg border ${STATUS_COLORS[lead.status]}`}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <a href={lead.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs hover:bg-card-hover">
            <ExternalLink className="w-3 h-3" /> View posting
          </a>
        </div>
        {lead.description && (
          <div className="mb-4">
            <p className="text-[10px] text-muted uppercase mb-1">Description</p>
            <p className="text-xs whitespace-pre-wrap text-foreground/80 max-h-48 overflow-y-auto">{lead.description.replace(/<[^>]+>/g, " ")}</p>
          </div>
        )}
        {lead.researchSummary ? (
          <div className="mb-4 p-3 rounded-lg bg-accent/5 border border-accent/20">
            <p className="text-[10px] text-accent uppercase mb-1 font-semibold">What they want</p>
            <p className="text-xs whitespace-pre-wrap">{lead.researchSummary}</p>
          </div>
        ) : (
          <button onClick={onResearch} disabled={researching} className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-accent/40 text-accent text-sm hover:bg-accent/10 disabled:opacity-60">
            {researching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Research lead
          </button>
        )}
        <button onClick={onOutreach} disabled={generatingOutreach} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dim disabled:opacity-60">
          {generatingOutreach ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Generate outreach email
        </button>
      </div>
    </div>
  );
}

function CompanyDetailPanel({
  company, onClose, onEnrich, onSelectLead,
}: {
  company: Company; onClose: () => void; onEnrich: () => void; onSelectLead: (j: JobLead) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-background border-l border-border h-full overflow-y-auto p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{company.name}</h2>
            {company.isFortune100 && <span className="text-xs text-amber-400">Fortune 100</span>}
            {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline block">{company.website.replace(/^https?:\/\//, "")}</a>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-card-hover"><X className="w-5 h-5" /></button>
        </div>
        {company.description && <p className="text-sm text-muted mb-4">{company.description}</p>}
        {parseTechStack(company.techStack).length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">{parseTechStack(company.techStack).map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-card border border-border">{t}</span>)}</div>
        )}
        <button onClick={onEnrich} className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-accent/40 text-accent text-sm hover:bg-accent/10">
          <RefreshCw className="w-4 h-4" /> Enrich + find contacts
        </button>
        {company.jobLeads && company.jobLeads.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] text-muted uppercase mb-2">Open roles ({company.jobLeads.length})</p>
            {company.jobLeads.map((j) => (
              <button key={j.id} onClick={() => onSelectLead(j)} className="block w-full text-left text-xs py-2 border-b border-border/50 hover:text-accent">{j.title}</button>
            ))}
          </div>
        )}
        {company.contacts && company.contacts.length > 0 && (
          <div>
            <p className="text-[10px] text-muted uppercase mb-2">Contacts ({company.contacts.length})</p>
            {company.contacts.map((c) => (
              <div key={c.id} className="text-xs py-1.5 border-b border-border/50">
                {c.name}{c.title ? ` · ${c.title}` : ""}
                {c.email && <a href={`mailto:${c.email}`} className="block text-accent">{c.email}</a>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
