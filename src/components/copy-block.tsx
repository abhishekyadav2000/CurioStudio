"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-sm text-muted whitespace-pre-wrap font-mono max-h-96 overflow-y-auto scrollbar-thin bg-background">
        {content}
      </pre>
    </div>
  );
}
