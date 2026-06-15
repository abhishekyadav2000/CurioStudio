export const PIPELINE_STAGES = ["import", "scan", "sandbox", "analyze", "content"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  import: "Import metadata",
  scan: "Security scan",
  sandbox: "Safe sandbox test",
  analyze: "LLM analysis",
  content: "Content generation",
};
