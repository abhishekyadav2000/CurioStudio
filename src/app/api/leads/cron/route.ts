import { NextResponse } from "next/server";
import { fetchAllLeads, getScanSettings } from "@/lib/leads";
import { checkScanRateLimit } from "@/lib/leads/rate-limit";

export async function GET() {
  const settings = await getScanSettings();
  if (!settings.leadsAutoScanEnabled) {
    return NextResponse.json({
      skipped: true,
      reason: "Auto-scan disabled",
      lastScanAt: settings.lastLeadsScanAt,
      intervalMinutes: settings.leadsAutoScanIntervalMinutes,
    });
  }

  const rateCheck = checkScanRateLimit();
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        skipped: true,
        reason: "Rate limited",
        retryAfterMs: rateCheck.retryAfterMs,
        lastScanAt: settings.lastLeadsScanAt,
      },
      { status: 429 }
    );
  }

  try {
    const result = await fetchAllLeads();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
