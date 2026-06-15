import { NextRequest, NextResponse } from "next/server";
import { verifyJobLead, verifyJobLeads } from "@/lib/leads/verify-posting";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { leadId, leadIds, limit } = body as {
    leadId?: string;
    leadIds?: string[];
    limit?: number;
  };

  try {
    if (leadId) {
      const result = await verifyJobLead(leadId);
      return NextResponse.json({ ok: true, result });
    }
    const result = await verifyJobLeads(leadIds, limit ?? 50);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
