import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { QueueProcessor } from "@/components/queue-processor";
import Link from "next/link";
import { Clapperboard, Mic, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudioIndexPage() {
  const ready = await prisma.project.findMany({
    where: { status: "SCRIPT_READY" },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: { content: { select: { youtubeTitle: true } } },
  });

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4 lg:p-8">
          <h2 className="text-2xl font-bold mb-2">Studio</h2>
          <p className="text-sm text-muted mb-6">Production hub — teleprompter, slides, premium connectors</p>

          {ready.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-border">
              <Clapperboard className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
              <p className="text-muted mb-4">No projects ready to record yet.</p>
              <Link href="/discover" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm">
                <TrendingUp className="w-4 h-4" />
                Discover & Queue
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {ready.map((p) => (
                <Link
                  key={p.id}
                  href={`/studio/${p.id}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-accent/30 transition-all group"
                >
                  <div>
                    <h4 className="font-semibold group-hover:text-accent">{p.name}</h4>
                    <p className="text-xs text-muted truncate">{p.content?.youtubeTitle}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-accent">
                    <Mic className="w-3 h-3" />
                    Open Studio
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      <QueueProcessor />
    </AppShell>
  );
}
