import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { syncNotifications } from "@/lib/system/notifications";

export async function GET() {
  await ensureSeeded();
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ notifications });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const notification = await prisma.notification.create({
    data: {
      type: body.type ?? "info",
      title: body.title,
      message: body.message,
      href: body.href,
    },
  });
  return NextResponse.json({ notification });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (body.all) {
    await prisma.notification.updateMany({ data: { read: true } });
    return NextResponse.json({ ok: true });
  }
  if (body.id) {
    await prisma.notification.update({
      where: { id: body.id },
      data: { read: body.read ?? true },
    });
  }
  return NextResponse.json({ ok: true });
}

/** Sync actionable notifications from project state */
export async function PUT() {
  await syncNotifications();
  return NextResponse.json({ synced: true });
}
