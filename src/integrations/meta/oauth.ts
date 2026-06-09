import { getServerConfig } from "@/lib/config.server";

const AUTH_BASE = "https://www.facebook.com/v21.0/dialog/oauth";

export function buildMetaAuthUrl(state: string): string {
  const { meta, appUrl } = getServerConfig();
  if (!meta.appId) throw new Error("META_APP_ID not configured");

  const redirectUri = `${appUrl}/api/oauth/meta/callback`;
  const params = new URLSearchParams({
    client_id: meta.appId,
    redirect_uri: redirectUri,
    state,
    scope: "ads_read,ads_management",
    response_type: "code",
  });

  return `${AUTH_BASE}?${params}`;
}

export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeMetaCode(code: string): Promise<MetaTokenResponse> {
  const { meta, appUrl } = getServerConfig();
  if (!meta.appId || !meta.appSecret) {
    throw new Error("Meta OAuth credentials not configured");
  }

  const redirectUri = `${appUrl}/api/oauth/meta/callback`;
  const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  url.searchParams.set("client_id", meta.appId);
  url.searchParams.set("client_secret", meta.appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString());
  const body = (await res.json()) as MetaTokenResponse & { error?: { message: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `Meta token exchange failed: ${res.status}`);
  return body;
}
