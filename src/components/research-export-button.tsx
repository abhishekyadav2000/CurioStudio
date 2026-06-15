"use client";

import { FileText, Download } from "lucide-react";
import { RESEARCH_EXPORT_TOOLTIP } from "@/lib/research-document/constants";

interface ResearchExportButtonProps {
  projectId: string;
  projectName?: string | null;
  variant?: "primary" | "secondary" | "compact" | "link";
  className?: string;
  showMarkdown?: boolean;
}

const TOOLTIP = RESEARCH_EXPORT_TOOLTIP;

export function ResearchExportButton({
  projectId,
  variant = "primary",
  className = "",
  showMarkdown = false,
}: ResearchExportButtonProps) {
  const href = `/api/projects/${projectId}/research-pdf`;
  const mdHref = `/api/projects/${projectId}/export?format=research`;

  if (variant === "link") {
    return (
      <a
        href={href}
        download
        title={TOOLTIP}
        className={`inline-flex items-center gap-1 text-accent hover:underline text-xs ${className}`}
      >
        <Download className="w-3 h-3" />
        Research PDF
      </a>
    );
  }

  if (variant === "compact") {
    return (
      <a
        href={href}
        download
        title={TOOLTIP}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border border-border hover:bg-card-hover ${className}`}
      >
        <Download className="w-3 h-3" />
        Export PDF
      </a>
    );
  }

  const base =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-dim"
      : "border border-border hover:bg-card-hover text-foreground";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <a
        href={href}
        download
        title={TOOLTIP}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors w-fit ${base}`}
      >
        <FileText className="w-4 h-4" />
        Export Research PDF
      </a>
      {showMarkdown && (
        <a
          href={mdHref}
          download
          title="Markdown version for NotebookLM text upload"
          className="text-[10px] text-muted hover:text-accent w-fit"
        >
          or download .md
        </a>
      )}
    </div>
  );
}
