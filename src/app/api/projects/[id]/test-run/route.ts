import { NextRequest, NextResponse } from "next/server";
import { rerunSandboxTest } from "@/lib/pipeline";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await rerunSandboxTest(id);
    return NextResponse.json({ ok: true, message: "Sandbox test completed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Test run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
