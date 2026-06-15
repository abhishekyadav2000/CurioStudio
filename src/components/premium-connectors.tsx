"use client";

import { useState } from "react";
import {
  PREMIUM_LINKS,
  buildChatGPTPrompt,
  buildNotebookLMBrief,
  buildRiversideTeleprompter,
  buildCanvaExportNotes,
  buildYouTubeMetadataBundle,
  type ConnectorContext,
} from "@/lib/connectors";
import { Copy, ExternalLink, Download, Check, Sparkles } from "lucide-react";

interface PremiumConnectorsProps {
  context: ConnectorContext;
  projectId: string;
  /** Which connectors to show — defaults to all */
  tools?: ("chatgpt" | "notebooklm" | "riverside" | "canva" | "youtube")[];
  compact?: boolean;
}

const TOOL_META = {
  chatgpt: { label: "ChatGPT", desc: "Copy formatted prompt + repo context" },
  notebooklm: { label: "NotebookLM", desc: "Download full research document (PDF or .md)" },
  riverside: { label: "Riverside.fm", desc: "Teleprompter + recording checklist" },
  canva: { label: "Canva", desc: "Post-prod notes + thumbnail SVG" },
  youtube: { label: "YouTube", desc: "Full metadata bundle + Studio link" },
} as const;

export function PremiumConnectors({
  context,
  projectId,
  tools = ["chatgpt", "notebooklm", "riverside", "canva", "youtube"],
  compact = false,
}: PremiumConnectorsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadText(filename: string, content: string, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const actions = {
    chatgpt: {
      copy: () => copyText("chatgpt", buildChatGPTPrompt(context)),
      open: PREMIUM_LINKS.chatgpt,
    },
    notebooklm: {
      copy: () => copyText("notebooklm", buildNotebookLMBrief(context)),
      download: () => {
        window.location.href = `/api/projects/${projectId}/export?format=research`;
      },
      open: PREMIUM_LINKS.notebooklm,
    },
    riverside: {
      copy: () => copyText("riverside", buildRiversideTeleprompter(context)),
      download: () =>
        downloadText(`${context.projectName}-teleprompter.txt`, buildRiversideTeleprompter(context)),
      open: PREMIUM_LINKS.riverside,
    },
    canva: {
      copy: () => copyText("canva", buildCanvaExportNotes(context)),
      download: () =>
        downloadText(
          `${context.projectName}-canva-notes.md`,
          buildCanvaExportNotes(context),
          "text/markdown"
        ),
      open: PREMIUM_LINKS.canva,
      extra: (
        <a
          href={`/api/projects/${projectId}/export?format=markdown`}
          download
          className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-card-hover"
        >
          <Download className="w-3 h-3" /> Production Pack
        </a>
      ),
    },
    youtube: {
      copy: () => copyText("youtube", buildYouTubeMetadataBundle(context)),
      download: () =>
        downloadText(`${context.projectName}-youtube-bundle.txt`, buildYouTubeMetadataBundle(context)),
      open: "https://studio.youtube.com/channel/upload",
    },
  };

  return (
    <div className={`rounded-xl border border-border bg-background/50 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-accent" />
        <h4 className={`font-medium ${compact ? "text-sm" : ""}`}>Premium Connectors</h4>
        <span className="text-xs text-muted">— bridge to your paid tools</span>
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {tools.map((tool) => {
          const meta = TOOL_META[tool];
          const act = actions[tool];
          return (
            <div key={tool} className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div>
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="text-xs text-muted">{meta.desc}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={act.copy}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20"
                >
                  {copied === tool ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied === tool ? "Copied" : "Copy"}
                </button>
                {"download" in act && act.download && (
                  <button
                    onClick={act.download}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-card-hover"
                  >
                    <Download className="w-3 h-3" /> Download
                  </button>
                )}
                <a
                  href={act.open}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs border border-border hover:bg-card-hover"
                >
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
                {"extra" in act && act.extra}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
