import { getServerConfig } from "@/lib/config.server";

const AUTH_BASE = "https://www.tiendanube.com/apps";

export function buildNuvemshopAuthUrl(state: string): string {
  const { nuvemshop, appUrl } = getServerConfig();
  if (!nuvemshop.clientId) throw new Error("NUVEMSHOP_CLIENT_ID not configured");

  const redirectUri = `${appUrl}/api/oauth/nuvemshop/callback`;
  const params = new URLSearchParams({
    state,
  });

  return `${AUTH_BASE}/${nuvemshop.clientId}/authorize?${params}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export interface NuvemshopTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  user_id: number;
}

export async function exchangeNuvemshopCode(code: string): Promise<NuvemshopTokenResponse> {
  const { nuvemshop } = getServerConfig();
  if (!nuvemshop.clientId || !nuvemshop.clientSecret) {
    throw new Error("Nuvemshop OAuth credentials not configured");
  }

  const res = await fetch(`${AUTH_BASE}/authorize/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: nuvemshop.clientId,
      client_secret: nuvemshop.clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });

  const body = (await res.json()) as NuvemshopTokenResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Nuvemshop token exchange failed: ${res.status}`);
  return body;
}
