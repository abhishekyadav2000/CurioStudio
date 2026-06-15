import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { StatusBadge, ScoreRing } from "@/components/badges";
import { QueueProcessor } from "@/components/queue-processor";
import { ShowtimeWidget } from "@/components/showtime-widget";
import { ensureSeeded } from "@/lib/seed";
import { getEpisodesThisMonth } from "@/lib/content/episodes";
import Link from "next/link";
import { RoutePrefetch } from "@/components/route-prefetch";
import {
  Star,
  Clapperboard,
  TrendingUp,
  Mic,
  Compass,
  ListTodo,
  ArrowRight,
  FileSearch,
} from "lucide-react";

export const dynamic = "force-dynamic";

const WORKFLOW_STEPS = [
  {
    step: 1,
    label: "Discover",
    desc: "Find trending OSS from 9 sources",
    href: "/discover",
    icon: TrendingUp,
  },
  {
    step: 2,
    label: "Queue",
    desc: "Scan, sandbox test, analyze safely",
    href: "/queue",
    icon: ListTodo,
  },
  {
    step: 3,
    label: "Record",
    desc: "Teleprompter + slides in Studio",
    href: "/studio",
    icon: Clapperboard,
  },
] as const;

export default async function DashboardPage() {
  await ensureSeeded();

  const [projects, jobCounts, trending, episodesMonth, totalProjects, newLeadsToday] =
    await Promise.all([
      prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          scan: { select: { riskScore: true, riskLevel: true } },
          scorecard: { select: { overallScore: true, videoWorthiness: true } },
          content: { select: { youtubeTitle: true } },
        },
        take: 12,
      }),
      prisma.job.groupBy({ by: ["status"], _count: true }),
      prisma.trendingEntry.findMany({
        where: { period: "daily", imported: false },
        orderBy: { rank: "asc" },
        take: 3,
      }),
      getEpisodesThisMonth(),
      prisma.project.count(),
      prisma.jobLead.count({
        where: {
          status: "NEW",
          capturedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

  const counts = {
    pending: jobCounts.find((j) => j.status === "PENDING")?._count ?? 0,
    scriptReady: projects.filter((p) => p.status === "SCRIPT_READY").length,
    published: projects.filter((p) => p.status === "UPLOADED").length,
    inPipeline: projects.filter(
      (p) => !["UPLOADED", "SKIPPED", "VIDEO_RECORDED", "SCRIPT_READY"].includes(p.status)
    ).length,
  };

  const readyProjects = projects.filter((p) => p.status === "SCRIPT_READY").slice(0, 3);
  const isNewUser = totalProjects === 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell noScroll>
      <RoutePrefetch />
      <div className="h-full flex flex-col overflow-hidden max-w-6xl mx-auto p-4 lg:p-5 gap-3">
        <header className="shrink-0">
          <p className="text-accent text-xs font-medium">{today}</p>
          <h2 className="text-xl lg:text-2xl font-bold mt-0.5">What to do today</h2>
        </header>

        {isNewUser && (
          <div className="shrink-0 p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-muted flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>
              New here? Follow the 3 steps below — Discover repos, Queue for safe review, then Record in Studio.
            </span>
          </div>
        )}

        <div className="shrink-0 grid grid-cols-3 gap-2">
          {WORKFLOW_STEPS.map(({ step, label, desc, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group p-3 rounded-xl bg-card border border-border hover:border-accent/40 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                  Step {step}
                </span>
                <ArrowRight className="w-3 h-3 text-muted group-hover:text-accent transition-colors" />
              </div>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-accent shrink-0" />
                <span className="font-semibold text-sm">{label}</span>
              </div>
              <p className="text-[10px] text-muted mt-1 line-clamp-1">{desc}</p>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 shrink-0">
          {[
            { label: "Episodes", value: episodesMonth, href: "/analytics" },
            { label: "Published", value: counts.published, accent: true, href: "/projects?status=UPLOADED" },
            { label: "In pipeline", value: counts.inPipeline, href: "/queue" },
            { label: "Scripts ready", value: counts.scriptReady, href: "/studio" },
            { label: "New leads today", value: newLeadsToday, href: "/leads", accent: newLeadsToday > 0 },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="p-2.5 rounded-lg bg-card border border-border hover:border-accent/30 transition-colors"
              title={`View ${stat.label}`}
            >
              <p className="text-[10px] text-muted">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.accent ? "text-accent" : ""}`}>{stat.value}</p>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-3 flex-1 min-h-0 overflow-hidden">
          <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
            <ShowtimeWidget compact />
          </div>

          <div className="lg:col-span-3 flex flex-col min-h-0 gap-2 overflow-hidden">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-semibold flex items-center gap-1">
                <Mic className="w-3.5 h-3.5 text-accent" />
                Ready to record
              </h3>
              <Link href="/studio" className="text-[10px] text-accent hover:underline">
                All in Studio →
              </Link>
            </div>
            {readyProjects.length === 0 ? (
              <p className="text-[11px] text-muted p-2.5 rounded-lg border border-dashed border-border shrink-0">
                Nothing ready yet.{" "}
                <Link href="/discover" className="text-accent hover:underline">
                  Queue from Discover
                </Link>
              </p>
            ) : (
              <div className="space-y-1.5 shrink-0">
                {readyProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/studio/${project.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border hover:border-accent/30 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{project.name}</p>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.scorecard?.overallScore != null && (
                      <ScoreRing score={project.scorecard.overallScore} size={28} />
                    )}
                  </Link>
                ))}
              </div>
            )}

            {trending.length > 0 && (
              <div className="p-2.5 rounded-lg bg-card border border-border flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-1.5 shrink-0">
                  <h3 className="font-semibold text-xs flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-accent" />
                    Trending preview
                  </h3>
                  <Link href="/discover" className="text-[10px] text-accent hover:underline">
                    Discover →
                  </Link>
                </div>
                <div className="space-y-1 overflow-hidden">
                  {trending.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted font-mono shrink-0">#{t.rank}</span>
                      <span className="flex-1 truncate">{t.fullName}</span>
                      {t.starsToday && (
                        <span className="text-muted flex items-center gap-0.5 shrink-0">
                          <Star className="w-2.5 h-2.5" />
                          {t.starsToday}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {counts.pending > 0 && (
              <Link
                href="/queue"
                className="shrink-0 flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs hover:border-amber-500/40 transition-colors"
              >
                <FileSearch className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  <strong className="text-foreground">{counts.pending}</strong> in queue — view pipeline
                </span>
                <ArrowRight className="w-3 h-3 ml-auto text-muted" />
              </Link>
            )}
          </div>
        </div>
      </div>
      <QueueProcessor />
    </AppShell>
  );
}
