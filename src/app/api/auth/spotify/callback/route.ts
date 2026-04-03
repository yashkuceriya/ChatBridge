import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeSpotifyCode } from "@/lib/auth/spotify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // Handle user-denied or Spotify errors
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}?spotify_auth=error&reason=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}?spotify_auth=error&reason=missing_params`
    );
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("spotify_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}?spotify_auth=error&reason=state_mismatch`
    );
  }

  // Clear the state cookie
  cookieStore.delete("spotify_oauth_state");

  try {
    const tokens = await exchangeSpotifyCode(code);

    const accessToken = tokens.accessToken();
    const refreshToken = tokens.hasRefreshToken()
      ? tokens.refreshToken()
      : null;
    const expiresInSeconds = tokens.accessTokenExpiresInSeconds();

    // Store tokens in httpOnly cookies.
    // In production with a running DB, these would go into the oauth_tokens table instead.
    cookieStore.set("spotify_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresInSeconds,
      path: "/",
    });

    if (refreshToken) {
      cookieStore.set("spotify_refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
    }

    // Set a non-httpOnly flag so the client can detect auth status
    cookieStore.set("spotify_authenticated", "true", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresInSeconds,
      path: "/",
    });

    return NextResponse.redirect(`${baseUrl}?spotify_auth=success`);
  } catch (err) {
    console.error("Spotify token exchange failed:", err);
    return NextResponse.redirect(
      `${baseUrl}?spotify_auth=error&reason=token_exchange_failed`
    );
  }
}
