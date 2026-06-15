import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import {
  getUpcomingSlots,
  getTodaysShowtime,
  createSlot,
  updateSlot,
  batchScheduleProjects,
} from "@/lib/business/calendar";
import type { AvailabilityStatus, Platform, SlotStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  await ensureSeeded();
  const view = request.nextUrl.searchParams.get("view");
  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10);

  if (view === "showtime") {
    const showtime = await getTodaysShowtime();
    return NextResponse.json(showtime);
  }

  if (view === "week") {
    const slots = await getUpcomingSlots(7);
    return NextResponse.json({ slots });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const where: { scheduledAt?: { gte?: Date; lte?: Date } } = {};

  if (from || to) {
    where.scheduledAt = {};
    if (from) where.scheduledAt.gte = new Date(from);
    if (to) where.scheduledAt.lte = new Date(to);
  } else {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.scheduledAt = { gte: start, lte: end };
  }

  const slots = await prisma.contentSlot.findMany({
    where,
    include: { project: { select: { id: true, name: true, status: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json({ slots, days });
}

export async function POST(request: NextRequest) {
  await ensureSeeded();
  const body = await request.json();
  const { action } = body;

  if (action === "batch") {
    const { projectIds, startDate } = body;
    if (!Array.isArray(projectIds) || !projectIds.length) {
      return NextResponse.json({ error: "projectIds required" }, { status: 400 });
    }
    const result = await batchScheduleProjects(projectIds, startDate ? new Date(startDate) : undefined);
    return NextResponse.json(result);
  }

  const {
    projectId,
    title,
    scheduledAt,
    endAt,
    platform,
    status,
    availability,
    location,
    agenda,
    episodeNumber,
    seriesName,
    notes,
  } = body;

  if (!title || !scheduledAt || !platform) {
    return NextResponse.json({ error: "title, scheduledAt, platform required" }, { status: 400 });
  }

  const slot = await createSlot({
    projectId,
    title,
    scheduledAt,
    endAt,
    platform: platform as Platform,
    status: status as SlotStatus | undefined,
    availability: availability as AvailabilityStatus | undefined,
    location,
    agenda,
    episodeNumber,
    seriesName,
    notes,
  });

  return NextResponse.json({ slot });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const slot = await updateSlot(id, data);
  return NextResponse.json({ slot });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.contentSlot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
