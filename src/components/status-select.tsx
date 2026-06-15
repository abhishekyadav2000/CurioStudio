"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { STATUS_CONFIG } from "@/lib/constants";
import { Loader2 } from "lucide-react";

export function StatusSelect({
  projectId,
  currentStatus,
}: {
  projectId: string;
  currentStatus: ProjectStatus;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleChange(newStatus: ProjectStatus) {
    setLoading(true);
    setStatus(newStatus);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {loading && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as ProjectStatus)}
        className="bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-accent"
      >
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <option key={key} value={key}>
            {config.label}
          </option>
        ))}
      </select>
    </div>
  );
}
