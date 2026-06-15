export type SandboxMode = "e2b" | "simulated";

export interface SandboxCapabilities {
  mode: SandboxMode;
  e2bConfigured: boolean;
  message: string;
}

export function getSandboxCapabilities(): SandboxCapabilities {
  const e2bConfigured = Boolean(process.env.E2B_API_KEY);
  if (e2bConfigured) {
    return {
      mode: "e2b",
      e2bConfigured: true,
      message: "E2B isolated sandboxes enabled — repos are cloned and tested remotely.",
    };
  }
  return {
    mode: "simulated",
    e2bConfigured: false,
    message:
      "Simulation mode — security scan runs for real, but install/run steps are preview-only. Set E2B_API_KEY for isolated execution.",
  };
}

export type SandboxVerdict = "passed" | "failed" | "simulated" | "skipped";

export function computeSandboxVerdict(input: {
  status: "completed" | "failed" | "simulated";
  installExitCode: number | null;
  smokeExitCode?: number | null;
}): SandboxVerdict {
  if (input.status === "simulated") return "simulated";
  if (input.status === "failed" || input.installExitCode !== 0) return "failed";
  if (input.smokeExitCode != null && input.smokeExitCode !== 0) return "failed";
  if (input.status === "completed") return "passed";
  return "skipped";
}
