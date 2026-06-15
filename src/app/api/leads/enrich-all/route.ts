import { NextResponse } from "next/server";
import { enrichAllCompanies } from "@/lib/leads/enrich";

export async function POST() {
  try {
    const result = await enrichAllCompanies();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrich all failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
