import { getServerConfig } from "@/lib/config.server";

/** Amazon SP-API OAuth — skeleton para Fase futura. */
export function getAmazonAuthUrl(state: string, clientId: string): string {
  const { appUrl } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/amazon/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.AMAZON_CLIENT_ID ?? "",
    redirect_uri: redirect,
    state: `${state}:${clientId}`,
    scope: "sellingpartnerapi::notifications",
  });
  return `https://sellercentral.amazon.com.br/apps/authorize/consent?${params}`;
}
