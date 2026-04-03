import { Spotify } from "arctic";
import { generateState, type OAuth2Tokens } from "arctic";

const SCOPES = [
  "user-read-private",
  "playlist-modify-public",
  "playlist-modify-private",
];

const REDIRECT_URI =
  (process.env.NEXTAUTH_URL ?? "http://localhost:3000") +
  "/api/auth/spotify/callback";

function getSpotifyClient(): Spotify | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new Spotify(clientId, clientSecret, REDIRECT_URI);
}

/**
 * Generate a Spotify authorization URL with the required scopes.
 * Returns null if Spotify credentials are not configured.
 */
export function getSpotifyAuthUrl(state: string): URL | null {
  const client = getSpotifyClient();
  if (!client) return null;

  // arctic v3 Spotify: codeVerifier is null (no PKCE for confidential clients)
  return client.createAuthorizationURL(state, null, SCOPES);
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Throws if Spotify credentials are not configured.
 */
export async function exchangeSpotifyCode(
  code: string
): Promise<OAuth2Tokens> {
  const client = getSpotifyClient();
  if (!client) {
    throw new Error(
      "Spotify OAuth is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local"
    );
  }

  return client.validateAuthorizationCode(code, null);
}

/**
 * Refresh an expired Spotify access token.
 * Throws if Spotify credentials are not configured.
 */
export async function refreshSpotifyToken(
  refreshToken: string
): Promise<OAuth2Tokens> {
  const client = getSpotifyClient();
  if (!client) {
    throw new Error(
      "Spotify OAuth is not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local"
    );
  }

  return client.refreshAccessToken(refreshToken);
}

export { generateState, SCOPES };
