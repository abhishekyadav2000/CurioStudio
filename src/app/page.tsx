import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ImportForm } from "@/components/import-form";
import { StatusBadge, ScoreRing } from "@/components/badges";
import { QueueProcessor } from "@/components/queue-processor";
import { ResearchExportButton } from "@/components/research-export-button";
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
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensureSeeded();

  const [projects, jobCounts, readyToday, trending, episodesMonth, marketingDue, totalProjects] =
    await Promise.all([
      prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          scan: { select: { riskScore: true, riskLevel: true } },
          scorecard: { select: { overallScore: true, videoWorthiness: true } },
          content: { select: { youtubeTitle: true } },
        },
        take: 8,
      }),
      prisma.job.groupBy({ by: ["status"], _count: true }),
      prisma.project.count({
        where: { status: "SCRIPT_READY", updatedAt: { gte: new Date(Date.now() - 86400000) } },
      }),
      prisma.trendingEntry.findMany({
        where: { period: "daily", imported: false },
        orderBy: { rank: "asc" },
        take: 3,
      }),
      getEpisodesThisMonth(),
      prisma.marketingCampaign.count({ where: { status: { in: ["DRAFT", "SCHEDULED"] } } }),
      prisma.project.count(),
    ]);

  const counts = {
    pending: jobCounts.find((j) => j.status === "PENDING")?._count ?? 0,
    scriptReady: projects.filter((p) => p.status === "SCRIPT_READY").length,
    recorded: projects.filter((p) => ["VIDEO_RECORDED", "UPLOADED"].includes(p.status)).length,
    published: projects.filter((p) => p.status === "UPLOADED").length,
    inPipeline: projects.filter(
      (p) => !["UPLOADED", "SKIPPED", "VIDEO_RECORDED", "SCRIPT_READY"].includes(p.status)
    ).length,
  };

  const readyProjects = projects.filter((p) => p.status === "SCRIPT_READY").slice(0, 2);
  const recentProjects = projects.slice(0, 4);
  const ready = projects.find((p) => p.status === "SCRIPT_READY");
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
        <header className="shrink-0 flex items-start justify-between gap-4">
          <div>
            <p className="text-accent text-xs font-medium">{today}</p>
            <h2 className="text-xl lg:text-2xl font-bold mt-0.5">What are we reviewing today?</h2>
          </div>
          <Link
            href={ready ? `/studio/${ready.id}` : "/discover"}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-dim shrink-0"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            {ready ? "Open Studio" : "Discover"}
          </Link>
        </header>

        {isNewUser && (
          <div className="shrink-0 p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-muted flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-accent font-medium flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" /> New here?
            </span>
            <span>
              <strong className="text-foreground">Discover</strong> — find trending repos
            </span>
            <span>
              <strong className="text-foreground">Queue</strong> — scan + sandbox test safely
            </span>
            <span>
              <strong className="text-foreground">Studio</strong> — record with generated scripts
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 shrink-0">
          {[
            { label: "Episodes", value: episodesMonth, href: "/analytics" },
            { label: "Published", value: counts.published, accent: true, href: "/projects" },
            { label: "In pipeline", value: counts.inPipeline, href: "/queue" },
            { label: "Scripts ready", value: counts.scriptReady, href: "/studio" },
            { label: "Marketing due", value: marketingDue, href: "/marketing" },
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
          <div className="lg:col-span-2 flex flex-col min-h-0 gap-2 overflow-hidden">
            <ImportForm />
            <div className="grid grid-cols-2 gap-2 shrink-0">
              <Link
                href="/discover"
                className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 hover:border-accent transition-all group"
              >
                <TrendingUp className="w-4 h-4 text-accent mb-1" />
                <h3 className="font-semibold text-xs">Discover</h3>
                <p className="text-[10px] text-muted">9 sources</p>
              </Link>
              <Link
                href="/queue"
                className="p-2.5 rounded-lg bg-card border border-border hover:border-accent/20 transition-all"
              >
                <ListTodo className="w-4 h-4 text-amber-400 mb-1" />
                <h3 className="font-semibold text-xs">{counts.pending} queued</h3>
                <p className="text-[10px] text-muted">{readyToday} ready today</p>
              </Link>
            </div>
            {trending.length > 0 && (
              <div className="p-2.5 rounded-lg bg-card border border-border shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="font-semibold text-xs flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-accent" />
                    Trending
                  </h3>
                  <Link href="/discover" className="text-[10px] text-accent hover:underline">
                    All sources →
                  </Link>
                </div>
                <div className="space-y-1">
                  {trending.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted font-mono">#{t.rank}</span>
                      <span className="flex-1 truncate">{t.fullName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
            <ShowtimeWidget compact />
          </div>

          <div className="lg:col-span-1 flex flex-col min-h-0 overflow-hidden gap-2">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs font-semibold flex items-center gap-1">
                <Mic className="w-3.5 h-3.5 text-accent" />
                Ready
              </h3>
              <Link href="/studio" className="text-[10px] text-accent hover:underline">
                Studio →
              </Link>
            </div>
            {readyProjects.length === 0 ? (
              <p className="text-[11px] text-muted p-2 rounded-lg border border-dashed border-border">
                Queue repos from Discover to generate scripts.
              </p>
            ) : (
              <div className="space-y-1.5 overflow-hidden">
                {readyProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-2 rounded-lg bg-card border border-border hover:border-accent/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Link href={`/studio/${project.id}`} className="font-medium text-xs truncate flex-1">
                        {project.name}
                      </Link>
                      {project.scorecard?.overallScore != null && (
                        <ScoreRing score={project.scorecard.overallScore} size={28} />
                      )}
                    </div>
                    <div className="mt-1">
                      <ResearchExportButton projectId={project.id} variant="link" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between shrink-0 pt-1 border-t border-border">
              <h3 className="text-xs font-semibold">Recent</h3>
              <Link href="/projects" className="text-[10px] text-accent hover:underline">
                All →
              </Link>
            </div>
            <div className="space-y-1 overflow-y-auto scrollbar-thin flex-1 min-h-0">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-card/80 border border-border text-[11px]"
                >
                  <div className="flex-1 min-w-0">
                    <Link href={`/projects/${project.id}`} className="font-medium hover:text-accent truncate block">
                      {project.name}
                    </Link>
                    <div className="flex items-center gap-2 text-muted">
                      <StatusBadge status={project.status} />
                      {project.stars != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" />
                          {project.stars.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <QueueProcessor />
    </AppShell>
  );
}
