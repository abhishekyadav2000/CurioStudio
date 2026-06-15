import { NextResponse } from "next/server";
import { fetchAllLeads } from "@/lib/leads";

export async function POST() {
  try {
    const result = await fetchAllLeads();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
