import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function syncNotifications(): Promise<void> {
  await ensureSeeded();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [scriptReady, recordingSlots] = await Promise.all([
    prisma.project.findMany({
      where: { status: "SCRIPT_READY" },
      take: 5,
      select: { id: true, name: true },
    }),
    prisma.contentSlot.findMany({
      where: { scheduledAt: { gte: today, lt: tomorrow } },
      include: { project: { select: { name: true } } },
    }),
  ]);

  for (const p of scriptReady) {
    const exists = await prisma.notification.findFirst({
      where: { title: `Script ready: ${p.name}`, read: false },
    });
    if (!exists) {
      await prisma.notification.create({
        data: {
          type: "action",
          title: `Script ready: ${p.name}`,
          message: "Open Studio to review and record",
          href: `/studio/${p.id}`,
        },
      });
    }
  }

  for (const slot of recordingSlots) {
    const exists = await prisma.notification.findFirst({
      where: { title: `Recording due: ${slot.title}`, read: false },
    });
    if (!exists) {
      await prisma.notification.create({
        data: {
          type: "warning",
          title: `Recording due: ${slot.title}`,
          message: slot.project?.name ?? "Calendar slot today",
          href: slot.projectId ? `/studio/${slot.projectId}` : "/calendar",
        },
      });
    }
  }
}
