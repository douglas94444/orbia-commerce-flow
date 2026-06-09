import { getServerConfig } from "@/lib/config.server";

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function buildGoogleAuthUrl(state: string): string {
  const { google, appUrl } = getServerConfig();
  if (!google.clientId) throw new Error("GOOGLE_CLIENT_ID not configured");

  const redirectUri = `${appUrl}/api/oauth/google/callback`;
  const params = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/adwords",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${AUTH_BASE}?${params}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleTokenResponse> {
  const { google, appUrl } = getServerConfig();
  if (!google.clientId || !google.clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const redirectUri = `${appUrl}/api/oauth/google/callback`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = (await res.json()) as GoogleTokenResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Google token exchange failed: ${res.status}`);
  return body;
}
