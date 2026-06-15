import { NextRequest, NextResponse } from "next/server";

/** Stub OAuth entry — configure GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET for full flow */
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      {
        error: "YouTube OAuth not configured",
        message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, or use Copy All for YouTube manual upload.",
        manualFallback: true,
        projectId,
      },
      { status: 501 }
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/youtube/callback`;
  const scope = encodeURIComponent("https://www.googleapis.com/auth/youtube.upload");
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&scope=${scope}&` +
    `access_type=offline&state=${projectId ?? ""}`;

  return NextResponse.redirect(authUrl);
}
