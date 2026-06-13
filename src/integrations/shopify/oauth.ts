import { getServerConfig } from "@/lib/config.server";

const SCOPES = "read_orders,write_orders,read_products,read_inventory";

export function buildShopifyAuthUrl(shop: string, state: string): string {
  const { shopify, appUrl } = getServerConfig();
  if (!shopify.clientId) throw new Error("SHOPIFY_CLIENT_ID not configured");

  const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  const redirectUri = `${appUrl}/api/oauth/shopify/callback`;

  const params = new URLSearchParams({
    client_id: shopify.clientId,
    scope: SCOPES,
    state,
    redirect_uri: redirectUri,
  });

  return `https://${host}/admin/oauth/authorize?${params}`;
}

export interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

export async function exchangeShopifyCode(
  shop: string,
  code: string,
): Promise<ShopifyTokenResponse> {
  const { shopify } = getServerConfig();
  if (!shopify.clientId || !shopify.clientSecret) {
    throw new Error("Shopify OAuth credentials not configured");
  }

  const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  const res = await fetch(`https://${host}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: shopify.clientId,
      client_secret: shopify.clientSecret,
      code,
    }),
  });

  const body = (await res.json()) as ShopifyTokenResponse & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Shopify token exchange failed: ${res.status}`);
  return body;
}

/** Shopify offline tokens are long-lived; validate and extend expiry. */
export async function refreshShopifyToken(
  shop: string,
  accessToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
  const res = await fetch(`https://${host}/admin/api/2024-01/shop.json`, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  if (!res.ok) throw new Error(`Shopify token invalid: ${res.status}`);
  return { access_token: accessToken, expires_in: 86400 * 365 };
}
