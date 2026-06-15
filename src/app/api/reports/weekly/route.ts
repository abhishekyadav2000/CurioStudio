import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { getTodaysShowtime } from "@/lib/business/calendar";
import { getEpisodesThisMonth } from "@/lib/content/episodes";

export async function GET() {
  await ensureSeeded();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [projects, jobs, slots, campaigns, episodesMonth, showtime] = await Promise.all([
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true, workflowStep: true, updatedAt: true },
    }),
    prisma.job.groupBy({ by: ["status"], _count: true }),
    prisma.contentSlot.findMany({
      where: { scheduledAt: { gte: weekStart, lte: weekEnd } },
      include: { project: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.marketingCampaign.findMany({
      where: { status: { in: ["DRAFT", "SCHEDULED"] } },
      take: 10,
      include: { project: { select: { name: true } } },
    }),
    getEpisodesThisMonth(),
    getTodaysShowtime(),
  ]);

  const published = projects.filter((p) => p.status === "UPLOADED").length;
  const inPipeline = projects.filter((p) =>
    ["FOUND", "SCANNED", "SANDBOX_CREATED", "INSTALL_SUCCESSFUL", "RUNNING", "REVIEWED", "SCRIPT_READY"].includes(
      p.status
    )
  ).length;

  const lines = [
    `# Weekly Production Report`,
    ``,
    `Generated: ${new Date().toLocaleString()}`,
    ``,
    `## Summary`,
    `- Episodes this month: **${episodesMonth}**`,
    `- Published: **${published}**`,
    `- In pipeline: **${inPipeline}**`,
  ];

  const pendingJobs = jobs.find((j) => j.status === "PENDING")?._count ?? 0;
  lines.push(`- Queue pending: **${pendingJobs}**`, ``);

  lines.push(`## This Week's Calendar`);
  if (slots.length === 0) {
    lines.push(`_No slots scheduled_`);
  } else {
    for (const s of slots) {
      lines.push(
        `- ${new Date(s.scheduledAt).toLocaleDateString()} · **${s.title}** (${s.platform}, ${s.status})`
      );
    }
  }

  lines.push(``, `## Marketing Due`);
  if (campaigns.length === 0) {
    lines.push(`_No draft campaigns_`);
  } else {
    for (const c of campaigns) {
      lines.push(`- ${c.name} — ${c.status}${c.project ? ` (${c.project.name})` : ""}`);
    }
  }

  lines.push(``, `## Showtime`);
  if (showtime.nextVideo) {
    lines.push(`- Next video: **${showtime.nextVideo.title}** at ${new Date(showtime.nextVideo.scheduledAt).toLocaleString()}`);
  }
  if (showtime.recordingToday) {
    lines.push(`- Recording today: **${showtime.recordingToday.title}**`);
  }

  lines.push(``, `## Projects`);
  for (const p of projects.slice(0, 15)) {
    lines.push(`- ${p.name ?? "Untitled"} — ${p.status} (${p.workflowStep})`);
  }

  const markdown = lines.join("\n");

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="weekly-report-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
}
