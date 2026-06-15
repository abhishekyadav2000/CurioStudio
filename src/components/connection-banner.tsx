"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

const POLL_MS = 30000;

export function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error("unhealthy");
      const data = await res.json();
      setOffline(!data.ok);
      if (data.ok) setDismissed(false);
    } catch {
      setOffline(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  if (!offline || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 text-black px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          Server offline — API unreachable. Run{" "}
          <code className="bg-black/10 px-1 rounded">npm run restart</code> in{" "}
          <code className="bg-black/10 px-1 rounded">~/CurioStudio</code>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={check}
          disabled={checking}
          className="flex items-center gap-1 px-2 py-1 rounded bg-black/10 hover:bg-black/20"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
          Retry
        </button>
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-black/10 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
