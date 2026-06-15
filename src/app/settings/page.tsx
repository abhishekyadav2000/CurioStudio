"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Loader2, CheckCircle, XCircle, ChevronDown } from "lucide-react";

interface Settings {
  seriesName: string;
  episodePrefix: string;
  creatorName: string;
  defaultScript: string;
  autoQueueTrending: number;
  healthWatchdog: boolean;
  scriptProvider: string;
  ollamaModel: string;
}

interface HealthStatus {
  ok: boolean;
  port: number;
  ollama: { online: boolean; models: string[]; error?: string };
  db: { ok: boolean; error?: string };
  providers: Record<string, boolean>;
}

const PROVIDER_OPTIONS = [
  { value: "auto", label: "Auto (best available)" },
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "template", label: "Template only" },
];

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl bg-card border border-border mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 text-left font-semibold hover:bg-card-hover/50"
      >
        {title}
        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [ollama, setOllama] = useState<{ online: boolean; models: string[]; error?: string } | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadAll() {
    const [settingsRes, healthRes] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    setSettings(settingsRes.settings);
    setOllama(settingsRes.ollama);
    setHealth(healthRes);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function save(updates: Partial<Settings>) {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    setSettings(data.settings);
    setOllama(data.ollama);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetch("/api/health").then((r) => r.json()).then(setHealth);
  }

  if (!settings) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto p-4 lg:p-8">
          <h2 className="text-2xl font-bold mb-1">Settings</h2>
          <p className="text-sm text-muted mb-6">
            Essentials here —{" "}
            <Link href="/docs/api-env" className="text-accent hover:underline">
              see Docs
            </Link>{" "}
            for env vars and advanced LLM config
          </p>

          <CollapsibleSection title="System status">
            <div className="grid sm:grid-cols-2 gap-2">
              <StatusRow ok={health?.ok ?? false} label={`App :${health?.port ?? 3000}`} detail={health?.ok ? "Running" : "Not reachable"} />
              <StatusRow ok={health?.db?.ok ?? false} label="Database" detail={health?.db?.ok ? "SQLite OK" : "Check DATABASE_URL"} />
              <StatusRow
                ok={ollama?.online ?? false}
                label="Ollama"
                detail={ollama?.online ? `${ollama.models.length} models` : ollama?.error ?? "Run ollama serve"}
              />
              <StatusRow
                ok={Boolean(health?.providers?.openai || health?.providers?.anthropic)}
                label="Premium LLM"
                detail={[health?.providers?.openai && "OpenAI", health?.providers?.anthropic && "Claude"].filter(Boolean).join(" + ") || "Add API keys"}
              />
            </div>
            <button onClick={loadAll} className="mt-3 text-xs text-accent hover:underline">
              Refresh
            </button>
          </CollapsibleSection>

          <CollapsibleSection title="Series & recording">
            <div className="space-y-3">
              <Field label="Series name" value={settings.seriesName} onSave={(v) => save({ seriesName: v })} onChange={(v) => setSettings({ ...settings, seriesName: v })} />
              <Field label="Your name (for scripts)" value={settings.creatorName} onSave={(v) => save({ creatorName: v })} onChange={(v) => setSettings({ ...settings, creatorName: v })} />
              <div>
                <label className="text-sm text-muted block mb-1">Default script length</label>
                <select
                  value={settings.defaultScript}
                  onChange={(e) => save({ defaultScript: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="5min">5 minutes</option>
                  <option value="10min">10 minutes</option>
                </select>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="LLM provider" defaultOpen={false}>
            <p className="text-xs text-muted mb-3">Script generation provider. Auto picks best available.</p>
            <select
              value={settings.scriptProvider}
              onChange={(e) => save({ scriptProvider: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3"
            >
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {ollama?.online && ollama.models.length > 0 && (
              <div>
                <label className="text-sm text-muted block mb-1">Ollama model</label>
                <select
                  value={settings.ollamaModel}
                  onChange={(e) => save({ ollamaModel: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  {ollama.models.map((m) => (
                    <option key={m} value={m.split(":")[0]}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </CollapsibleSection>

          {saving && <p className="text-sm text-muted">Saving…</p>}
          {saved && <p className="text-sm text-accent">Saved!</p>}
        </div>
    </AppShell>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-background border border-border">
      <div className="flex items-center gap-2 mb-0.5">
        {ok ? <CheckCircle className="w-3.5 h-3.5 text-accent" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onSave,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-muted block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onSave(value)}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
      />
    </div>
  );
}
