import { getServerConfig } from "@/lib/config.server";

const AUTH_BASE = "https://www.facebook.com/v21.0/dialog/oauth";

export function buildMetaWhatsAppAuthUrl(state: string): string {
  const { meta, appUrl } = getServerConfig();
  if (!meta.appId) throw new Error("META_APP_ID not configured");

  const redirectUri = `${appUrl}/api/oauth/whatsapp/callback`;
  const params = new URLSearchParams({
    client_id: meta.appId,
    redirect_uri: redirectUri,
    state,
    scope: "whatsapp_business_messaging,whatsapp_business_management,business_management",
    response_type: "code",
  });

  return `${AUTH_BASE}?${params}`;
}

export { exchangeMetaCode } from "./oauth";
