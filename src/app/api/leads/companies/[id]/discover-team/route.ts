import { NextRequest, NextResponse } from "next/server";
import { discoverTeam } from "@/lib/leads/team-discovery";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle : undefined;

  try {
    const result = await discoverTeam(id, jobTitle);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Team discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
