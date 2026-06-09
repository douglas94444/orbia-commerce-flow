import { createHmac } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";

const API_HOST = "https://partner.shopeemobile.com";

function signAuth(path: string, timestamp: number): string {
  const { shopee } = getServerConfig();
  const base = `${shopee.partnerId}${path}${timestamp}`;
  return createHmac("sha256", shopee.partnerKey ?? "").update(base).digest("hex");
}

export function buildShopeeAuthUrl(shopId: string, state: string): string {
  const { shopee, appUrl } = getServerConfig();
  if (!shopee.partnerId) throw new Error("SHOPEE_PARTNER_ID not configured");

  const path = "/api/v2/shop/auth_partner";
  const timestamp = Math.floor(Date.now() / 1000);
  const redirect = `${appUrl}/api/oauth/shopee/callback`;

  const url = new URL(`${API_HOST}${path}`);
  url.searchParams.set("partner_id", shopee.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signAuth(path, timestamp));
  url.searchParams.set("redirect", redirect);
  url.searchParams.set("state", state);

  void shopId;
  return url.toString();
}

export interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;
}

export async function exchangeShopeeCode(
  shopId: string,
  code: string,
): Promise<ShopeeTokenResponse> {
  const { shopee } = getServerConfig();
  const path = "/api/v2/auth/token/get";
  const timestamp = Math.floor(Date.now() / 1000);

  const url = new URL(`${API_HOST}${path}`);
  url.searchParams.set("partner_id", shopee.partnerId ?? "");
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signAuth(path, timestamp));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      shop_id: Number(shopId),
      partner_id: Number(shopee.partnerId),
    }),
  });

  const body = (await res.json()) as { response?: ShopeeTokenResponse; error?: string };
  if (!res.ok || !body.response) {
    throw new Error(body.error ?? `Shopee token exchange failed: ${res.status}`);
  }
  return body.response;
}
