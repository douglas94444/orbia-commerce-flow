import { getServerConfig } from "@/lib/config.server";

export function buildTikTokAuthUrl(state: string): string {
  const { appUrl, tiktok } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/tiktok/callback`;
  const params = new URLSearchParams({
    app_key: tiktok.appKey ?? "",
    state,
    redirect_uri: redirect,
  });
  return `https://auth.tiktok-shops.com/oauth/authorize?${params}`;
}

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token?: string;
  access_token_expire_in: number;
  shop_id?: string;
}

export async function exchangeTikTokCode(code: string): Promise<TikTokTokenResponse> {
  const { appUrl, tiktok } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/tiktok/callback`;

  const res = await fetch("https://auth.tiktok-shops.com/api/v2/token/get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_key: tiktok.appKey,
      app_secret: tiktok.appSecret,
      auth_code: code,
      grant_type: "authorized_code",
      redirect_uri: redirect,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TikTok token exchange failed: ${body}`);
  }

  const json = (await res.json()) as { data?: TikTokTokenResponse };
  const data = json.data;
  if (!data?.access_token) throw new Error("TikTok token response missing access_token");
  return data;
}

/** @deprecated Use buildTikTokAuthUrl */
export function getTikTokAuthUrl(state: string, _clientId: string): string {
  return buildTikTokAuthUrl(state);
}
