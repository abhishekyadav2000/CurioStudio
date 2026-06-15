import { prisma } from "@/lib/db";

export interface PruneResult {
  archived: number;
  deleted: number;
}

/** Archive or delete stale job leads based on maxAgeDays settings. */
export async function pruneStaleLeads(maxAgeDays = 45): Promise<PruneResult> {
  const now = new Date();
  const maxAgeCutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const noDateCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Archive leads with postedAt older than maxAgeDays
  const archivedByPosted = await prisma.jobLead.updateMany({
    where: {
      status: { not: "ARCHIVED" },
      postedAt: { lt: maxAgeCutoff },
    },
    data: { status: "ARCHIVED" },
  });

  // Archive leads with no postedAt but capturedAt > 60 days
  const archivedByCaptured = await prisma.jobLead.updateMany({
    where: {
      status: { not: "ARCHIVED" },
      postedAt: null,
      capturedAt: { lt: noDateCutoff },
    },
    data: { status: "ARCHIVED" },
  });

  // Remove duplicate archived entries (same normalizedKey, keep newest)
  const dupes = await prisma.jobLead.groupBy({
    by: ["normalizedKey"],
    where: {
      normalizedKey: { not: null },
      status: "ARCHIVED",
    },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  let deleted = 0;
  for (const group of dupes) {
    if (!group.normalizedKey) continue;
    const leads = await prisma.jobLead.findMany({
      where: { normalizedKey: group.normalizedKey, status: "ARCHIVED" },
      orderBy: { capturedAt: "desc" },
    });
    const toDelete = leads.slice(1);
    if (toDelete.length > 0) {
      const result = await prisma.jobLead.deleteMany({
        where: { id: { in: toDelete.map((l) => l.id) } },
      });
      deleted += result.count;
    }
  }

  return {
    archived: archivedByPosted.count + archivedByCaptured.count,
    deleted,
  };
}
