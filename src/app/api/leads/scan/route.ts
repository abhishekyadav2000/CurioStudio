import { NextResponse } from "next/server";
import { fetchAllLeads } from "@/lib/leads";
import { checkScanRateLimit } from "@/lib/leads/rate-limit";

export async function POST() {
  const rateCheck = checkScanRateLimit();
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Scan rate limited", retryAfterMs: rateCheck.retryAfterMs },
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

export async function GET() {
  return POST();
}
