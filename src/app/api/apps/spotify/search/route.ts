import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { refreshSpotifyToken } from "@/lib/auth/spotify";

interface SpotifySearchResult {
  id: string;
  name: string;
  artist: string;
  album: string;
  previewUrl: string | null;
  externalUrl: string | null;
  imageUrl: string | null;
}

const MOCK_RESULTS: SpotifySearchResult[] = [
  { id: "1", name: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", previewUrl: null, externalUrl: null, imageUrl: null },
  { id: "2", name: "Hotel California", artist: "Eagles", album: "Hotel California", previewUrl: null, externalUrl: null, imageUrl: null },
  { id: "3", name: "Stairway to Heaven", artist: "Led Zeppelin", album: "Led Zeppelin IV", previewUrl: null, externalUrl: null, imageUrl: null },
  { id: "4", name: "Imagine", artist: "John Lennon", album: "Imagine", previewUrl: null, externalUrl: null, imageUrl: null },
  { id: "5", name: "Smells Like Teen Spirit", artist: "Nirvana", album: "Nevermind", previewUrl: null, externalUrl: null, imageUrl: null },
];

async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("spotify_access_token")?.value;

  if (accessToken) {
    return accessToken;
  }

  // Try to refresh using the refresh token
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;
  if (!refreshToken) {
    return null;
  }

  try {
    const tokens = await refreshSpotifyToken(refreshToken);
    const newAccessToken = tokens.accessToken();
    const expiresInSeconds = tokens.accessTokenExpiresInSeconds();

    // Update cookies with new tokens
    cookieStore.set("spotify_access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresInSeconds,
      path: "/",
    });

    cookieStore.set("spotify_authenticated", "true", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresInSeconds,
      path: "/",
    });

    if (tokens.hasRefreshToken()) {
      cookieStore.set("spotify_refresh_token", tokens.refreshToken(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return newAccessToken;
  } catch (err) {
    console.error("Failed to refresh Spotify token:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, type = "track" } = body as {
    query?: string;
    type?: string;
  };

  if (!query) {
    return NextResponse.json(
      { error: "Missing 'query' in request body" },
      { status: 400 }
    );
  }

  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    // Return mock results with auth_required flag
    const q = query.toLowerCase();
    const filtered = MOCK_RESULTS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
    return NextResponse.json({
      results: filtered.length > 0 ? filtered : MOCK_RESULTS.slice(0, 3),
      auth_required: true,
      mock: true,
    });
  }

  // Call the real Spotify Web API
  try {
    const params = new URLSearchParams({
      q: query,
      type,
      limit: "20",
    });

    const response = await fetch(
      `https://api.spotify.com/v1/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Spotify API error:", response.status, errorData);

      // If unauthorized, signal auth is needed
      if (response.status === 401) {
        return NextResponse.json(
          { error: "Spotify token expired", auth_required: true },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Spotify API request failed", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Map Spotify's response to our simplified format
    const results: SpotifySearchResult[] = [];

    if (type === "track" && data.tracks?.items) {
      for (const item of data.tracks.items) {
        results.push({
          id: item.id,
          name: item.name,
          artist: item.artists?.map((a: { name: string }) => a.name).join(", ") ?? "Unknown",
          album: item.album?.name ?? "Unknown",
          previewUrl: item.preview_url ?? null,
          externalUrl: item.external_urls?.spotify ?? null,
          imageUrl: item.album?.images?.[0]?.url ?? null,
        });
      }
    }

    return NextResponse.json({
      results,
      auth_required: false,
      mock: false,
    });
  } catch (err) {
    console.error("Spotify search failed:", err);
    return NextResponse.json(
      { error: "Failed to search Spotify" },
      { status: 500 }
    );
  }
}
