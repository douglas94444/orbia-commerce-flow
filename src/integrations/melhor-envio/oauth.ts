import { getServerConfig } from "@/lib/config.server";

const AUTH_BASE = "https://melhorenvio.com.br/oauth/authorize";

export function buildMelhorEnvioAuthUrl(state: string): string {
  const { melhorEnvio, appUrl } = getServerConfig();
  if (!melhorEnvio.clientId) throw new Error("MELHOR_ENVIO_CLIENT_ID not configured");

  const redirectUri = `${appUrl}/api/oauth/melhor-envio/callback`;
  const params = new URLSearchParams({
    client_id: melhorEnvio.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    scope: "cart-read cart-write companies-read companies-write coupons-read coupons-write notifications-read orders-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read users-write",
  });

  return `${AUTH_BASE}?${params}`;
}

export interface MeTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function refreshMelhorEnvioToken(refreshToken: string): Promise<MeTokenResponse> {
  const { melhorEnvio } = getServerConfig();
  if (!melhorEnvio.clientId || !melhorEnvio.clientSecret) {
    throw new Error("Melhor Envio OAuth credentials not configured");
  }

  const res = await fetch("https://melhorenvio.com.br/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: melhorEnvio.clientId,
      client_secret: melhorEnvio.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const body = (await res.json()) as MeTokenResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Melhor Envio token refresh failed: ${res.status}`);
  return body;
}

export async function exchangeMelhorEnvioCode(code: string): Promise<MeTokenResponse> {
  const { melhorEnvio, appUrl } = getServerConfig();
  if (!melhorEnvio.clientId || !melhorEnvio.clientSecret) {
    throw new Error("Melhor Envio OAuth credentials not configured");
  }

  const redirectUri = `${appUrl}/api/oauth/melhor-envio/callback`;
  const res = await fetch("https://melhorenvio.com.br/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: melhorEnvio.clientId,
      client_secret: melhorEnvio.clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  const body = (await res.json()) as MeTokenResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Melhor Envio token exchange failed: ${res.status}`);
  return body;
}
