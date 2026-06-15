import { prisma } from "@/lib/db";
import type { Platform, SlotStatus } from "@prisma/client";

export interface SlotInput {
  projectId?: string | null;
  title: string;
  scheduledAt: Date | string;
  platform: Platform;
  status?: SlotStatus;
  episodeNumber?: number | null;
  seriesName?: string | null;
  notes?: string | null;
}

export async function getUpcomingSlots(days = 7) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);

  return prisma.contentSlot.findMany({
    where: { scheduledAt: { gte: from, lte: to } },
    include: { project: { select: { id: true, name: true, status: true } } },
    orderBy: { scheduledAt: "asc" },
  });
}

export async function getTodaysShowtime() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [nextVideo, recordingToday, publishThisWeek] = await Promise.all([
    prisma.contentSlot.findFirst({
      where: {
        scheduledAt: { gte: new Date() },
        platform: "YOUTUBE",
        status: { in: ["PLANNED", "SCHEDULED"] },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.contentSlot.findFirst({
      where: {
        scheduledAt: { gte: start, lt: end },
        status: { in: ["PLANNED", "SCHEDULED"] },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.contentSlot.findMany({
      where: {
        scheduledAt: { gte: start, lte: new Date(start.getTime() + 7 * 86400000) },
        status: { in: ["PLANNED", "SCHEDULED", "RECORDED"] },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
  ]);

  return { nextVideo, recordingToday, publishThisWeek };
}

/** Batch schedule: assign Mon–Fri slots for N projects */
export async function batchScheduleProjects(projectIds: string[], startDate?: Date) {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const seriesName = settings?.seriesName ?? "Everyday Series";
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(10, 0, 0, 0);

  const slots = [];
  let dayOffset = 0;
  let scheduled = 0;

  for (const projectId of projectIds) {
    while (dayOffset < 14) {
      const d = new Date(start);
      d.setDate(d.getDate() + dayOffset);
      dayOffset++;
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { content: true },
      });
      if (!project) continue;

      const slot = await prisma.contentSlot.create({
        data: {
          projectId,
          title: project.content?.youtubeTitle ?? project.name ?? "Untitled",
          scheduledAt: d,
          platform: "YOUTUBE",
          status: "SCHEDULED",
          seriesName,
        },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { scheduledPublishAt: d },
      });
      slots.push(slot);
      scheduled++;
      break;
    }
  }

  return { slots, scheduled };
}

export async function createSlot(input: SlotInput) {
  return prisma.contentSlot.create({
    data: {
      ...input,
      scheduledAt: new Date(input.scheduledAt),
    },
    include: { project: true },
  });
}

export async function updateSlot(id: string, data: Partial<SlotInput>) {
  return prisma.contentSlot.update({
    where: { id },
    data: {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
    },
    include: { project: true },
  });
}
