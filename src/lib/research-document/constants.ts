export const RESEARCH_DOCUMENT_SECTIONS = [
  "Executive Summary",
  "Source Metadata",
  "README Summary & Excerpts",
  "Technical Analysis",
  "Security & Sandbox Scan",
  "Test Run Verdict",
  "Content Analysis & Hook Ideas",
  "Risks, Limitations & Coverage Decision",
  "Video Angles & Everyday Series Fit",
  "Sources & URLs",
  "Screenshots",
  "Raw Dependency Excerpts",
  "Editor Notes",
] as const;

export const RESEARCH_EXPORT_TOOLTIP = `Includes: ${RESEARCH_DOCUMENT_SECTIONS.slice(0, 6).join(", ")}, and more.`;
