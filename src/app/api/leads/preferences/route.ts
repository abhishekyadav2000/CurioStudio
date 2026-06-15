import { NextRequest, NextResponse } from "next/server";
import {
  getJobPreferences,
  saveJobPreferences,
  rescoreAllOpenLeads,
  type JobPreferences,
} from "@/lib/leads";
import { prisma } from "@/lib/db";

export async function GET() {
  const preferences = await getJobPreferences();
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    preferences,
    scanSettings: {
      leadsAutoScanIntervalMinutes: settings?.leadsAutoScanIntervalMinutes ?? 5,
      leadsMaxAgeDays: settings?.leadsMaxAgeDays ?? 45,
      leadsAutoScanEnabled: settings?.leadsAutoScanEnabled ?? true,
      lastLeadsScanAt: settings?.lastLeadsScanAt ?? null,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const {
    preferences,
    leadsAutoScanIntervalMinutes,
    leadsMaxAgeDays,
    leadsAutoScanEnabled,
  } = body as {
    preferences?: Partial<JobPreferences>;
    leadsAutoScanIntervalMinutes?: number;
    leadsMaxAgeDays?: number;
    leadsAutoScanEnabled?: boolean;
  };

  if (preferences) {
    const current = await getJobPreferences();
    const merged: JobPreferences = {
      ...current,
      ...preferences,
      preferencesSet: true,
    };
    await saveJobPreferences(merged);
    await rescoreAllOpenLeads(merged);
  }

  const settingsUpdate: Record<string, unknown> = {};
  if (typeof leadsAutoScanIntervalMinutes === "number") {
    settingsUpdate.leadsAutoScanIntervalMinutes = Math.max(1, Math.min(60, leadsAutoScanIntervalMinutes));
  }
  if (typeof leadsMaxAgeDays === "number") {
    settingsUpdate.leadsMaxAgeDays = Math.max(7, Math.min(90, leadsMaxAgeDays));
  }
  if (typeof leadsAutoScanEnabled === "boolean") {
    settingsUpdate.leadsAutoScanEnabled = leadsAutoScanEnabled;
  }

  if (Object.keys(settingsUpdate).length > 0) {
    await prisma.appSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...settingsUpdate },
      update: settingsUpdate,
    });
  }

  return NextResponse.json({ ok: true, preferences: await getJobPreferences() });
}
