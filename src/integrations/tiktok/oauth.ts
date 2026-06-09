import { getServerConfig } from "@/lib/config.server";

/** TikTok Shop OAuth — skeleton para Fase futura. */
export function getTikTokAuthUrl(state: string, clientId: string): string {
  const { appUrl, tiktok } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/tiktok/callback`;
  const params = new URLSearchParams({
    app_key: tiktok.appKey ?? "",
    state: `${state}:${clientId}`,
    redirect_uri: redirect,
  });
  return `https://auth.tiktok-shops.com/oauth/authorize?${params}`;
}
