import { ProjectStatus } from "@prisma/client";

export const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; description: string }
> = {
  FOUND: { label: "Found", color: "bg-slate-500", description: "Project imported" },
  SCANNED: { label: "Scanned", color: "bg-blue-500", description: "Pre-run scan complete" },
  SANDBOX_CREATED: { label: "Sandbox", color: "bg-indigo-500", description: "Isolated environment ready" },
  INSTALL_FAILED: { label: "Install Failed", color: "bg-red-500", description: "Dependencies failed" },
  INSTALL_SUCCESSFUL: { label: "Installed", color: "bg-emerald-500", description: "Install succeeded" },
  RUNNING: { label: "Running", color: "bg-amber-500", description: "Project executing" },
  REVIEWED: { label: "Reviewed", color: "bg-purple-500", description: "Analysis complete" },
  SCRIPT_READY: { label: "Script Ready", color: "bg-pink-500", description: "Content generated" },
  VIDEO_RECORDED: { label: "Recorded", color: "bg-orange-500", description: "Video filmed" },
  UPLOADED: { label: "Uploaded", color: "bg-green-600", description: "Published" },
  SKIPPED: { label: "Skipped", color: "bg-gray-400", description: "Not pursuing" },
};

export const WORKFLOW_STEPS: ProjectStatus[] = [
  "FOUND",
  "SCANNED",
  "SANDBOX_CREATED",
  "INSTALL_SUCCESSFUL",
  "REVIEWED",
  "SCRIPT_READY",
  "VIDEO_RECORDED",
  "UPLOADED",
];

export const SCORECARD_TEMPLATE = {
  sections: [
    { id: "identity", title: "Project Identity", fields: ["name", "owner", "source", "stars", "license"] },
    { id: "purpose", title: "Purpose & Value", fields: ["whatItDoes", "problemSolved", "usefulnessScore"] },
    { id: "technical", title: "Technical Review", fields: ["techStack", "installDifficulty", "setupSteps"] },
    { id: "safety", title: "Safety Assessment", fields: ["riskScore", "riskLevel", "suspiciousFiles", "vulnerabilities"] },
    { id: "execution", title: "Sandbox Results", fields: ["whatWorked", "whatFailed", "installCommand", "logs"] },
    { id: "content", title: "Content Decision", fields: ["videoWorthiness", "overallScore", "recommendation"] },
  ],
};
