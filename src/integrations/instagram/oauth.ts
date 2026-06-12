import { getServerConfig } from "@/lib/config.server";

const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_read_engagement",
  "commerce_account_read",
].join(",");

export function buildInstagramAuthUrl(state: string): string {
  const { appUrl, meta } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/instagram/callback`;
  const params = new URLSearchParams({
    client_id: meta.appId ?? "",
    redirect_uri: redirect,
    state,
    scope: INSTAGRAM_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export interface InstagramTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeInstagramCode(code: string): Promise<InstagramTokenResponse> {
  const { appUrl, meta } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/instagram/callback`;

  const params = new URLSearchParams({
    client_id: meta.appId ?? "",
    client_secret: meta.appSecret ?? "",
    redirect_uri: redirect,
    code,
  });

  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram token exchange failed: ${body}`);
  }

  return body;
}

export async function refreshInstagramToken(refreshToken: string): Promise<InstagramTokenResponse> {
  const { meta } = getServerConfig();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: meta.appId ?? "",
    client_secret: meta.appSecret ?? "",
    fb_exchange_token: refreshToken,
  });

  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Instagram token refresh failed: ${body}`);
  }

  return res.json() as Promise<InstagramTokenResponse>;
}
