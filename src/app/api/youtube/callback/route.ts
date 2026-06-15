import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("state");
  const base = request.nextUrl.origin;

  // Full token exchange requires GOOGLE_CLIENT_SECRET — redirect to publish step with manual export
  return NextResponse.redirect(
    `${base}/studio/${projectId ?? ""}?step=publish&oauth=manual`
  );
}
