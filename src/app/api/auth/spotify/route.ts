import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSpotifyAuthUrl, generateState } from "@/lib/auth/spotify";

export async function GET() {
  const state = generateState();
  const authUrl = getSpotifyAuthUrl(state);

  if (!authUrl) {
    return NextResponse.json(
      {
        error: "Spotify OAuth is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
      },
      { status: 500 }
    );
  }

  // Store state in a cookie for CSRF verification in the callback
  const cookieStore = await cookies();
  cookieStore.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  return NextResponse.redirect(authUrl.toString());
}
