export type LLMProvider = "ollama" | "openai" | "claude" | "template";
export type ProviderChoice = "auto" | LLMProvider;
export type LLMTask = "script" | "slides" | "refine" | "thumbnail" | "metadata" | "vision";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaVisionModel: string;
  openaiScriptModel: string;
  openaiQuickModel: string;
  anthropicModel: string;
  scriptProvider: ProviderChoice;
  slideProvider: ProviderChoice;
  refineProvider: ProviderChoice;
  thumbnailProvider: ProviderChoice;
}

export interface OllamaModelRecommendation {
  id: string;
  label: string;
  bestFor: string[];
  pullCommand: string;
}

export const OLLAMA_RECOMMENDATIONS: OllamaModelRecommendation[] = [
  {
    id: "llama3.3",
    label: "Llama 3.3",
    bestFor: ["scripts", "refine"],
    pullCommand: "ollama pull llama3.3",
  },
  {
    id: "qwen2.5:14b",
    label: "Qwen 2.5 14B",
    bestFor: ["scripts", "slides"],
    pullCommand: "ollama pull qwen2.5:14b",
  },
  {
    id: "mistral-large",
    label: "Mistral Large",
    bestFor: ["slides", "metadata"],
    pullCommand: "ollama pull mistral-large",
  },
  {
    id: "deepseek-r1",
    label: "DeepSeek R1",
    bestFor: ["scripts", "refine"],
    pullCommand: "ollama pull deepseek-r1",
  },
  {
    id: "llava",
    label: "LLaVA",
    bestFor: ["vision"],
    pullCommand: "ollama pull llava",
  },
  {
    id: "bakllava",
    label: "BakLLaVA",
    bestFor: ["vision"],
    pullCommand: "ollama pull bakllava",
  },
];

/** Priority order for auto-selecting the best installed text model */
export const OLLAMA_TEXT_PRIORITY = [
  "llama3.3",
  "deepseek-r1",
  "qwen2.5:14b",
  "mistral-large",
  "llama3.2",
  "llama3.1",
  "mistral",
];

export const OLLAMA_VISION_PRIORITY = ["llava", "bakllava", "llama3.2-vision"];
