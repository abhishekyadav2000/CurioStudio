import { NextRequest, NextResponse } from "next/server";
import {
  getJobPreferences,
  saveJobPreferences,
  rescoreAllOpenLeads,
  type JobPreferences,
} from "@/lib/leads";
import { prisma } from "@/lib/db";

async function handlePreferencesUpdate(body: {
  preferences?: Partial<JobPreferences>;
  leadsAutoScanIntervalMinutes?: number;
  leadsMaxAgeDays?: number;
  leadsAutoScanEnabled?: boolean;
}) {
  const {
    preferences,
    leadsAutoScanIntervalMinutes,
    leadsMaxAgeDays,
    leadsAutoScanEnabled,
  } = body;

  if (preferences) {
    const current = await getJobPreferences();
    const merged: JobPreferences = {
      targetRoles: preferences.targetRoles ?? current.targetRoles,
      keywords: preferences.keywords ?? current.keywords,
      locations: preferences.locations ?? current.locations,
      remoteOnly: preferences.remoteOnly ?? current.remoteOnly,
      excludeCompanies: preferences.excludeCompanies ?? current.excludeCompanies,
      minSalary: preferences.minSalary ?? current.minSalary,
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

  return getJobPreferences();
}

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
  try {
    const body = await request.json();
    const saved = await handlePreferencesUpdate(body);
    return NextResponse.json({ ok: true, preferences: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
