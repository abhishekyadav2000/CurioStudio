import type { LLMConfig, LLMMessage, LLMTask, LLMProvider } from "./types";
import {
  getLLMConfig,
  getProviderForTask,
  getModelForTask,
  getEffectiveOllamaModels,
  checkOllamaHealth,
  checkDatabaseHealth,
  getConfiguredPort,
  hasOpenAI,
  hasAnthropic,
  pickBestOllamaModel,
} from "./config";

export type { LLMProvider, LLMConfig, LLMMessage, LLMTask, ProviderChoice, OllamaModelRecommendation } from "./types";
export { OLLAMA_RECOMMENDATIONS } from "./types";
export {
  getLLMConfig,
  checkOllamaHealth,
  checkDatabaseHealth,
  getConfiguredPort,
  hasOpenAI,
  hasAnthropic,
  pickBestOllamaModel,
  resolveProvider,
  getProviderForTask,
  getEffectiveOllamaModels,
} from "./config";
export {
  SCRIPT_SYSTEM_PROMPT,
  SLIDES_SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
  THUMBNAIL_SYSTEM_PROMPT,
  METADATA_SYSTEM_PROMPT,
  VISION_PROMPT,
  CONTENT_GENERATION_SYSTEM_PROMPT,
} from "./prompts";

const PROVIDER_FALLBACK_ORDER: LLMProvider[] = ["openai", "claude", "ollama"];

async function withResolvedConfig(
  task: LLMTask,
  config?: LLMConfig
): Promise<{ cfg: LLMConfig; provider: LLMProvider; model: string }> {
  const cfg = config ?? (await getLLMConfig());
  const provider = getProviderForTask(cfg, task);
  let model = getModelForTask(cfg, task, provider);

  if (provider === "ollama") {
    const effective = await getEffectiveOllamaModels(cfg);
    model = task === "vision" ? effective.visionModel : effective.textModel;
  }

  return { cfg, provider, model };
}

function nextFallback(current: LLMProvider): LLMProvider | null {
  const idx = PROVIDER_FALLBACK_ORDER.indexOf(current);
  for (let i = idx + 1; i < PROVIDER_FALLBACK_ORDER.length; i++) {
    const p = PROVIDER_FALLBACK_ORDER[i];
    if (p === "openai" && hasOpenAI()) return p;
    if (p === "claude" && hasAnthropic()) return p;
    if (p === "ollama") return p;
  }
  return null;
}

export async function generateJSON<T>(
  messages: LLMMessage[],
  task: LLMTask = "script",
  config?: LLMConfig
): Promise<T | null> {
  const { cfg, provider, model } = await withResolvedConfig(task, config);
  if (provider === "template") return null;

  let currentProvider: LLMProvider = provider;
  let currentModel = model;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (currentProvider === "template") break;
    const result = await generateJSONWithProvider<T>(messages, currentProvider, currentModel, cfg, task);
    if (result) return result;

    const fallback = nextFallback(currentProvider);
    if (!fallback || fallback === currentProvider) break;
    currentProvider = fallback;
    currentModel = getModelForTask(cfg, task, fallback);
    if (fallback === "ollama") {
      const effective = await getEffectiveOllamaModels(cfg);
      currentModel = effective.textModel;
    }
  }

  return null;
}

async function generateJSONWithProvider<T>(
  messages: LLMMessage[],
  provider: LLMProvider,
  model: string,
  cfg: LLMConfig,
  task: LLMTask
): Promise<T | null> {
  if (provider === "ollama") {
    return generateOllamaJSON<T>(messages, cfg, model);
  }
  if (provider === "openai" && hasOpenAI()) {
    return generateOpenAIJSON<T>(messages, model);
  }
  if (provider === "claude" && hasAnthropic()) {
    return generateClaudeJSON<T>(messages, model);
  }
  return null;
}

export async function generateText(
  messages: LLMMessage[],
  task: LLMTask = "script",
  config?: LLMConfig
): Promise<string | null> {
  const result = await generateJSON<{ text?: string }>(
    [
      ...messages,
      { role: "user", content: 'Respond with JSON: {"text": "your response here"}' },
    ],
    task,
    config
  );
  if (result?.text) return result.text;

  const { cfg, provider, model } = await withResolvedConfig(task, config);
  if (provider === "ollama") {
    try {
      const res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
        signal: AbortSignal.timeout(120000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.message?.content ?? null;
      }
    } catch {
      // fall through
    }
  }

  if (hasOpenAI()) {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }

  if (hasAnthropic()) {
    return generateClaudeText(messages, cfg.anthropicModel);
  }

  return null;
}

export async function generateTextWithVision(
  prompt: string,
  imageBase64: string,
  mimeType: string = "image/png",
  config?: LLMConfig
): Promise<string | null> {
  const { cfg, provider, model } = await withResolvedConfig("vision", config);

  if (provider === "ollama") {
    try {
      const res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt, images: [imageBase64] }],
          stream: false,
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.message?.content ?? null;
      }
    } catch {
      // fall through to premium
    }
  }

  if (hasOpenAI()) {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: cfg.openaiScriptModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 500,
      });
      return completion.choices[0]?.message?.content ?? null;
    } catch {
      // fall through
    }
  }

  if (hasAnthropic()) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: cfg.anthropicModel,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: imageBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      });
      const block = response.content[0];
      return block.type === "text" ? block.text : null;
    } catch {
      return null;
    }
  }

  return null;
}

/** Generate thumbnail image via DALL-E 3 when OpenAI key is set */
export async function generateThumbnailImage(prompt: string): Promise<string | null> {
  if (!hasOpenAI()) return null;
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: "1792x1024",
      quality: "standard",
    });
    return result.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function generateOllamaJSON<T>(messages: LLMMessage[], cfg: LLMConfig, model: string): Promise<T | null> {
  try {
    const res = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          ...messages,
          {
            role: "user",
            content: "Respond with valid JSON only. No markdown fences, no explanation outside the JSON object.",
          },
        ],
        stream: false,
        format: "json",
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function generateOpenAIJSON<T>(messages: LLMMessage[], model: string): Promise<T | null> {
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages,
      temperature: 0.7,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function generateClaudeJSON<T>(messages: LLMMessage[], model: string): Promise<T | null> {
  const text = await generateClaudeText(
    [
      ...messages,
      {
        role: "user",
        content: "Respond with valid JSON only. No markdown fences, no explanation outside the JSON object.",
      },
    ],
    model
  );
  if (!text) return null;
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

async function generateClaudeText(messages: LLMMessage[], model: string): Promise<string | null> {
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const system = messages.find((m) => m.role === "system")?.content;
    const chatMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: system ?? undefined,
      messages: chatMessages,
    });
    const block = response.content[0];
    return block.type === "text" ? block.text : null;
  } catch {
    return null;
  }
}
