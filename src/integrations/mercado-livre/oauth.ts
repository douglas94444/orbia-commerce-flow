import { getServerConfig } from "@/lib/config.server";

const AUTH_BASE = "https://auth.mercadolivre.com.br";

export function buildMercadoLivreAuthUrl(state: string): string {
  const { mercadoLivre, appUrl } = getServerConfig();
  if (!mercadoLivre.clientId) throw new Error("ML_CLIENT_ID not configured");

  const redirectUri = `${appUrl}/api/oauth/mercado-livre/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: mercadoLivre.clientId,
    redirect_uri: redirectUri,
    state,
  });

  return `${AUTH_BASE}/authorization?${params}`;
}

export interface MlTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  scope: string;
}

export async function exchangeMercadoLivreCode(code: string): Promise<MlTokenResponse> {
  const { mercadoLivre, appUrl } = getServerConfig();
  if (!mercadoLivre.clientId || !mercadoLivre.clientSecret) {
    throw new Error("ML OAuth credentials not configured");
  }

  const redirectUri = `${appUrl}/api/oauth/mercado-livre/callback`;
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: mercadoLivre.clientId,
      client_secret: mercadoLivre.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const body = (await res.json()) as MlTokenResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `ML token exchange failed: ${res.status}`);
  return body;
}
