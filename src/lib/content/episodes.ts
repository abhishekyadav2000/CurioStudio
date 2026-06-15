import { prisma } from "@/lib/db";
import type { EpisodeStatus } from "@prisma/client";

export async function getNextEpisodeNumber(projectId: string): Promise<number> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const seriesProjects = await prisma.project.findMany({
    where: { id: projectId },
    select: { id: true },
  });
  if (!seriesProjects.length) return 1;

  const max = await prisma.episode.aggregate({
    _max: { number: true },
    where: { projectId },
  });
  return (max._max.number ?? 0) + 1;
}

export async function createEpisodeForProject(
  projectId: string,
  opts?: { title?: string; status?: EpisodeStatus }
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { content: true },
  });
  if (!project) throw new Error("Project not found");

  const number = await getNextEpisodeNumber(projectId);
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  const prefix = settings?.episodePrefix ?? "Ep";
  const title =
    opts?.title ??
    project.content?.youtubeTitle ??
    `${prefix} ${number}: ${project.name ?? "Untitled"}`;

  return prisma.episode.create({
    data: {
      projectId,
      number,
      title,
      status: opts?.status ?? "DRAFT",
    },
  });
}

export async function getEpisodesThisMonth() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return prisma.episode.count({
    where: { createdAt: { gte: start } },
  });
}
