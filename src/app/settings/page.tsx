"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Loader2, CheckCircle, XCircle, Cpu, Server, Key, Sparkles } from "lucide-react";
import type { OllamaModelRecommendation } from "@/lib/llm";

interface Settings {
  llmProvider: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaVisionModel: string;
  openaiModel: string;
  openaiScriptModel: string;
  openaiQuickModel: string;
  anthropicModel: string;
  scriptProvider: string;
  slideProvider: string;
  refineProvider: string;
  thumbnailProvider: string;
  seriesName: string;
  episodePrefix: string;
  creatorName: string;
  defaultScript: string;
  autoQueueTrending: number;
  healthWatchdog: boolean;
}

interface HealthStatus {
  ok: boolean;
  port: number;
  ollama: { online: boolean; models: string[]; error?: string };
  db: { ok: boolean; error?: string };
  providers: Record<string, boolean>;
  watchdog?: {
    enabled: boolean;
    restartHint: string;
    folderHasTrailingSpace: boolean;
    recommendedFolder: string;
  };
}

const TASK_LABELS = [
  { key: "scriptProvider" as const, label: "Script generation", hint: "gpt-4o or llama3.3 recommended" },
  { key: "slideProvider" as const, label: "Slide generation", hint: "Claude or mistral-large for structure" },
  { key: "refineProvider" as const, label: "Refine script", hint: "Claude Sonnet excels at alignment" },
  { key: "thumbnailProvider" as const, label: "Thumbnail / metadata", hint: "gpt-4o-mini or DALL-E 3" },
];

const PROVIDER_OPTIONS = [
  { value: "auto", label: "Auto (best available)" },
  { value: "openai", label: "OpenAI (ChatGPT)" },
  { value: "claude", label: "Anthropic (Claude)" },
  { value: "ollama", label: "Ollama (local)" },
  { value: "template", label: "Template only" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [ollama, setOllama] = useState<{ online: boolean; models: string[]; error?: string } | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [connectors, setConnectors] = useState<Record<string, boolean>>({});
  const [recommendations, setRecommendations] = useState<OllamaModelRecommendation[]>([]);
  const [recommendedModel, setRecommendedModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadAll() {
    const [settingsRes, healthRes] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    setSettings(settingsRes.settings);
    setOllama(settingsRes.ollama);
    setConnectors(settingsRes.connectors ?? {});
    setRecommendations(settingsRes.recommendations ?? []);
    setRecommendedModel(settingsRes.recommendedModel ?? "");
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
    setConnectors(data.connectors ?? {});
    setRecommendedModel(data.recommendedModel ?? "");
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
      <div className="max-w-3xl mx-auto p-4 lg:p-8">
          <h2 className="text-2xl font-bold mb-1">Settings</h2>
          <p className="text-sm text-muted mb-8">Hybrid local + premium content production</p>

          {/* System Status */}
          <section className="p-5 rounded-xl bg-card border border-border mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" />
              System Status
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <StatusRow
                ok={health?.ok ?? false}
                label={`Localhost :${health?.port ?? 3000}`}
                detail={health?.ok ? "App responding" : "Not reachable — run npm run start:mac"}
              />
              <StatusRow
                ok={health?.db?.ok ?? false}
                label="Database"
                detail={health?.db?.ok ? "SQLite connected" : health?.db?.error ?? "Check DATABASE_URL"}
              />
              <StatusRow
                ok={ollama?.online ?? false}
                label="Ollama"
                detail={
                  ollama?.online
                    ? `${ollama.models.length} models${recommendedModel ? ` · best: ${recommendedModel}` : ""}`
                    : ollama?.error ?? "Run: ollama serve"
                }
              />
              <StatusRow
                ok={Boolean(health?.providers?.openai || health?.providers?.anthropic)}
                label="Premium LLM"
                detail={[
                  health?.providers?.openai && "OpenAI",
                  health?.providers?.anthropic && "Claude",
                ]
                  .filter(Boolean)
                  .join(" + ") || "Add API keys to .env"}
              />
            </div>
            <button
              onClick={loadAll}
              className="mt-3 text-xs text-accent hover:underline"
            >
              Refresh status
            </button>
          </section>

          {/* LLM Providers per task */}
          <section className="p-5 rounded-xl bg-card border border-border mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" />
              LLM Providers (per task)
            </h3>
            <p className="text-xs text-muted mb-4">
              Auto routes to best premium API if keys exist, then best Ollama model, then template.
            </p>
            <div className="space-y-4">
              {TASK_LABELS.map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="text-sm font-medium block mb-1">{label}</label>
                  <p className="text-xs text-muted mb-1">{hint}</p>
                  <select
                    value={settings[key]}
                    onChange={(e) => save({ [key]: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    {PROVIDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-border space-y-4">
              <h4 className="text-sm font-medium">Ollama (local)</h4>
              <div>
                <label className="text-sm text-muted block mb-1">Base URL</label>
                <input
                  value={settings.ollamaBaseUrl}
                  onChange={(e) => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                  onBlur={() => save({ ollamaBaseUrl: settings.ollamaBaseUrl })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted block mb-1">Text model</label>
                  {ollama?.online && ollama.models.length > 0 ? (
                    <select
                      value={settings.ollamaModel}
                      onChange={(e) => save({ ollamaModel: e.target.value })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    >
                      {ollama.models.map((m) => (
                        <option key={m} value={m.split(":")[0]}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={settings.ollamaModel}
                      onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                      onBlur={() => save({ ollamaModel: settings.ollamaModel })}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      placeholder="llama3.3"
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm text-muted block mb-1">Vision model</label>
                  <input
                    value={settings.ollamaVisionModel}
                    onChange={(e) => setSettings({ ...settings, ollamaVisionModel: e.target.value })}
                    onBlur={() => save({ ollamaVisionModel: settings.ollamaVisionModel })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    placeholder="llava"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted block mb-1">OpenAI script model</label>
                  <input
                    value={settings.openaiScriptModel}
                    onChange={(e) => setSettings({ ...settings, openaiScriptModel: e.target.value })}
                    onBlur={() => save({ openaiScriptModel: settings.openaiScriptModel })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    placeholder="gpt-4o"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-1">OpenAI quick tasks</label>
                  <input
                    value={settings.openaiQuickModel}
                    onChange={(e) => setSettings({ ...settings, openaiQuickModel: e.target.value })}
                    onBlur={() => save({ openaiQuickModel: settings.openaiQuickModel })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                    placeholder="gpt-4o-mini"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Anthropic model</label>
                <input
                  value={settings.anthropicModel}
                  onChange={(e) => setSettings({ ...settings, anthropicModel: e.target.value })}
                  onBlur={() => save({ anthropicModel: settings.anthropicModel })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  placeholder="claude-sonnet-4-20250514"
                />
              </div>
            </div>
          </section>

          {/* Recommended models */}
          <section className="p-5 rounded-xl bg-card border border-border mb-6">
            <h3 className="font-semibold mb-4">Recommended Ollama Models (Mac)</h3>
            <div className="space-y-2">
              {recommendations.map((rec) => {
                const installed = ollama?.models.some((m) => m.startsWith(rec.id));
                return (
                  <div key={rec.id} className="flex items-start justify-between p-3 rounded-lg bg-background border border-border">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {rec.label}
                        {installed ? (
                          <CheckCircle className="w-3 h-3 text-accent" />
                        ) : (
                          <span className="text-xs text-muted">not installed</span>
                        )}
                      </p>
                      <p className="text-xs text-muted">Best for: {rec.bestFor.join(", ")}</p>
                    </div>
                    <code className="text-xs text-accent shrink-0">{rec.pullCommand}</code>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Premium Connectors status */}
          <section className="p-5 rounded-xl bg-card border border-border mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              Premium Connectors
            </h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {[
                ["OpenAI (ChatGPT)", connectors.openai, "OPENAI_API_KEY"],
                ["Anthropic (Claude)", connectors.anthropic, "ANTHROPIC_API_KEY"],
                ["E2B Sandbox", connectors.e2b, "E2B_API_KEY"],
                ["GitHub API", connectors.github, "GITHUB_TOKEN"],
                ["YouTube OAuth", connectors.youtubeOAuth, "GOOGLE_CLIENT_ID"],
              ].map(([name, configured, envKey]) => (
                <div key={String(name)} className="flex items-center gap-2 p-2 rounded bg-background">
                  {configured ? (
                    <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted shrink-0" />
                  )}
                  <span>{name}</span>
                  {!configured && (
                    <code className="text-xs text-muted ml-auto">{envKey}</code>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">
              ChatGPT, NotebookLM, Riverside, Canva, and YouTube bridges work in Production Hub regardless of API keys.
            </p>
          </section>

          {/* Series config */}
          <section className="p-5 rounded-xl bg-card border border-border mb-6">
            <h3 className="font-semibold mb-4">Series & Recording</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted block mb-1">Series Name</label>
                <input
                  value={settings.seriesName}
                  onChange={(e) => setSettings({ ...settings, seriesName: e.target.value })}
                  onBlur={() => save({ seriesName: settings.seriesName })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Episode Prefix</label>
                <input
                  value={settings.episodePrefix}
                  onChange={(e) => setSettings({ ...settings, episodePrefix: e.target.value })}
                  onBlur={() => save({ episodePrefix: settings.episodePrefix })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  placeholder="Ep"
                />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Your Name (for scripts)</label>
                <input
                  value={settings.creatorName}
                  onChange={(e) => setSettings({ ...settings, creatorName: e.target.value })}
                  onBlur={() => save({ creatorName: settings.creatorName })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  placeholder="Abhishek"
                />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Default Script Length</label>
                <select
                  value={settings.defaultScript}
                  onChange={(e) => save({ defaultScript: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="5min">5 minutes</option>
                  <option value="10min">10 minutes</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Auto-queue from Trending</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={settings.autoQueueTrending}
                  onChange={(e) => setSettings({ ...settings, autoQueueTrending: Number(e.target.value) })}
                  onBlur={() => save({ autoQueueTrending: settings.autoQueueTrending })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          {/* Env keys */}
          <section className="p-5 rounded-xl bg-card border border-border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-accent" />
              Environment Keys (.env)
            </h3>
            <div className="space-y-2 text-sm font-mono">
              {[
                ["OPENAI_API_KEY", "ChatGPT / gpt-4o / DALL-E 3"],
                ["ANTHROPIC_API_KEY", "Claude Sonnet refinement"],
                ["OLLAMA_BASE_URL", "Default: http://localhost:11434"],
                ["OLLAMA_MODEL", "Default: llama3.3"],
                ["E2B_API_KEY", "Real sandbox execution"],
                ["GITHUB_TOKEN", "Higher API rate limits"],
                ["GOOGLE_CLIENT_ID", "YouTube OAuth (optional)"],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between p-2 rounded bg-background">
                  <span className="text-accent">{key}</span>
                  <span className="text-muted text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Health watchdog */}
          <section className="p-5 rounded-xl bg-card border border-border mb-6">
            <h3 className="font-semibold mb-3">Health Watchdog</h3>
            <p className="text-xs text-muted mb-3">
              If the app stops responding, the connection banner polls /api/health every 30s.
              For a clean restart: <code className="bg-background px-1 rounded">npm run restart</code> in ~/CurioStudio
            </p>
            {health?.watchdog?.folderHasTrailingSpace && (
              <p className="text-xs text-warning mb-3 p-2 rounded bg-warning/10 border border-warning/20">
                Folder path has trailing space — rename to <strong>curiostudio</strong> to avoid Turbopack/cache issues.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.healthWatchdog}
                onChange={(e) => save({ healthWatchdog: e.target.checked })}
              />
              Enable health watchdog hints in UI
            </label>
          </section>

          {saving && <p className="text-sm text-muted mt-4">Saving…</p>}
          {saved && <p className="text-sm text-accent mt-4">Saved!</p>}
        </div>
    </AppShell>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="p-3 rounded-lg bg-background border border-border">
      <div className="flex items-center gap-2 mb-1">
        {ok ? (
          <CheckCircle className="w-4 h-4 text-accent" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  );
}
