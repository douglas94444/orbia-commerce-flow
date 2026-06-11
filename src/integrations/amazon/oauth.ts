import { getServerConfig } from "@/lib/config.server";

export function buildAmazonAuthUrl(state: string): string {
  const { appUrl, amazon } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/amazon/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: amazon.clientId ?? "",
    redirect_uri: redirect,
    state,
    scope: "sellingpartnerapi::notifications",
  });
  return `https://sellercentral.amazon.com.br/apps/authorize/consent?${params}`;
}

export interface AmazonTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeAmazonCode(code: string): Promise<AmazonTokenResponse> {
  const { appUrl, amazon } = getServerConfig();
  const redirect = `${appUrl}/api/oauth/amazon/callback`;

  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: amazon.clientId ?? "",
      client_secret: amazon.clientSecret ?? "",
      redirect_uri: redirect,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Amazon token exchange failed: ${body}`);
  }

  return res.json() as Promise<AmazonTokenResponse>;
}

/** @deprecated Use buildAmazonAuthUrl */
export function getAmazonAuthUrl(state: string, _clientId: string): string {
  return buildAmazonAuthUrl(state);
}
