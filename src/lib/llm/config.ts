import type { LLMConfig, LLMTask, LLMProvider, ProviderChoice } from "./types";
import {
  OLLAMA_TEXT_PRIORITY,
  OLLAMA_VISION_PRIORITY,
} from "./types";

const DEFAULT_CONFIG: LLMConfig = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3.3",
  ollamaVisionModel: process.env.OLLAMA_VISION_MODEL || "llava",
  openaiScriptModel: process.env.OPENAI_SCRIPT_MODEL || "gpt-4o",
  openaiQuickModel: process.env.OPENAI_QUICK_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  scriptProvider: (process.env.SCRIPT_PROVIDER as ProviderChoice) || "auto",
  slideProvider: (process.env.SLIDE_PROVIDER as ProviderChoice) || "auto",
  refineProvider: (process.env.REFINE_PROVIDER as ProviderChoice) || "auto",
  thumbnailProvider: (process.env.THUMBNAIL_PROVIDER as ProviderChoice) || "auto",
};

export async function getLLMConfig(): Promise<LLMConfig> {
  try {
    const { prisma } = await import("@/lib/db");
    const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
    if (settings) {
      return {
        ollamaBaseUrl: settings.ollamaBaseUrl,
        ollamaModel: settings.ollamaModel,
        ollamaVisionModel: settings.ollamaVisionModel ?? "llava",
        openaiScriptModel: settings.openaiScriptModel ?? settings.openaiModel ?? "gpt-4o",
        openaiQuickModel: settings.openaiQuickModel ?? settings.openaiModel ?? "gpt-4o-mini",
        anthropicModel: settings.anthropicModel ?? "claude-sonnet-4-20250514",
        scriptProvider: (settings.scriptProvider ?? settings.llmProvider ?? "auto") as ProviderChoice,
        slideProvider: (settings.slideProvider ?? "auto") as ProviderChoice,
        refineProvider: (settings.refineProvider ?? "auto") as ProviderChoice,
        thumbnailProvider: (settings.thumbnailProvider ?? "auto") as ProviderChoice,
      };
    }
  } catch {
    // DB not ready
  }
  return DEFAULT_CONFIG;
}

export function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function taskToSettingKey(task: LLMTask): keyof LLMConfig {
  switch (task) {
    case "script":
      return "scriptProvider";
    case "slides":
      return "slideProvider";
    case "refine":
      return "refineProvider";
    case "thumbnail":
    case "metadata":
      return "thumbnailProvider";
    case "vision":
      return "scriptProvider";
  }
}

/** Smart routing: premium first when auto, then Ollama, then template */
export function resolveProvider(choice: ProviderChoice, task: LLMTask, config: LLMConfig): LLMProvider {
  if (choice === "template") return "template";
  if (choice === "ollama") return "ollama";
  if (choice === "openai") return hasOpenAI() ? "openai" : fallbackFromOllama(task);
  if (choice === "claude") return hasAnthropic() ? "claude" : fallbackFromPremium(task);

  // auto routing
  switch (task) {
    case "script":
      if (hasOpenAI()) return "openai";
      if (hasAnthropic()) return "claude";
      return "ollama";
    case "slides":
      if (hasAnthropic()) return "claude";
      if (hasOpenAI()) return "openai";
      return "ollama";
    case "refine":
      if (hasAnthropic()) return "claude";
      if (hasOpenAI()) return "openai";
      return "ollama";
    case "thumbnail":
    case "metadata":
      if (hasOpenAI()) return "openai";
      if (hasAnthropic()) return "claude";
      return "ollama";
    case "vision":
      if (hasOpenAI()) return "openai";
      if (hasAnthropic()) return "claude";
      return "ollama";
  }
}

function fallbackFromPremium(task: LLMTask): LLMProvider {
  if (hasOpenAI()) return "openai";
  return "ollama";
}

function fallbackFromOllama(_task: LLMTask): LLMProvider {
  if (hasAnthropic()) return "claude";
  return "ollama";
}

export function getProviderForTask(config: LLMConfig, task: LLMTask): LLMProvider {
  const key = taskToSettingKey(task);
  const choice = config[key] as ProviderChoice;
  return resolveProvider(choice, task, config);
}

export function getModelForTask(config: LLMConfig, task: LLMTask, provider: LLMProvider): string {
  if (provider === "openai") {
    if (task === "script" || task === "refine" || task === "slides") return config.openaiScriptModel;
    if (task === "vision") return config.openaiScriptModel;
    return config.openaiQuickModel;
  }
  if (provider === "claude") return config.anthropicModel;
  if (provider === "ollama") {
    if (task === "vision") return config.ollamaVisionModel;
    return config.ollamaModel;
  }
  return "";
}

/** Pick best installed Ollama model from priority list */
export function pickBestOllamaModel(installed: string[], task: LLMTask = "script"): string {
  const normalized = installed.map((m) => m.split(":")[0]);
  const priority = task === "vision" ? OLLAMA_VISION_PRIORITY : OLLAMA_TEXT_PRIORITY;
  for (const preferred of priority) {
    const match = normalized.find((m) => m === preferred || m.startsWith(preferred));
    if (match) return match;
  }
  return normalized[0] ?? "llama3.3";
}

export async function getEffectiveOllamaModels(config: LLMConfig): Promise<{
  textModel: string;
  visionModel: string;
}> {
  const health = await checkOllamaHealth(config.ollamaBaseUrl);
  if (!health.online || !health.models.length) {
    return { textModel: config.ollamaModel, visionModel: config.ollamaVisionModel };
  }
  return {
    textModel: pickBestOllamaModel(health.models, "script"),
    visionModel: pickBestOllamaModel(health.models, "vision"),
  };
}

export async function checkOllamaHealth(baseUrl?: string): Promise<{
  online: boolean;
  models: string[];
  error?: string;
}> {
  const url = baseUrl || DEFAULT_CONFIG.ollamaBaseUrl;
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const models = (data.models ?? []).map((m: { name: string }) => m.name);
    return { online: true, models };
  } catch (err) {
    return { online: false, models: [], error: err instanceof Error ? err.message : "Offline" };
  }
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB unavailable" };
  }
}

export function getConfiguredPort(): number {
  return Number(process.env.PORT) || 3000;
}
