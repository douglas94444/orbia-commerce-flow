import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { createHmac } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const API_HOST = "https://partner.shopeemobile.com";

function signRequest(path: string, timestamp: number, accessToken: string, shopId: string): string {
  const { shopee } = getServerConfig();
  const base = `${shopee.partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac("sha256", shopee.partnerKey ?? "").update(base).digest("hex");
}

export async function getShopeeOrderDetail(
  clientId: string,
  orderSn: string,
): Promise<Record<string, unknown> | null> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account")
    .eq("client_id", clientId)
    .eq("provider", "shopee")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token || !conn.external_account) return null;

  const shopId = conn.external_account;
  const accessToken = decryptToken(conn.access_token);
  const path = "/api/v2/order/get_order_detail";
  const timestamp = Math.floor(Date.now() / 1000);
  const end = startTimer();

  const url = new URL(`${API_HOST}${path}`);
  url.searchParams.set("partner_id", getServerConfig().shopee.partnerId ?? "");
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signRequest(path, timestamp, accessToken, shopId));
  url.searchParams.set("shop_id", shopId);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("order_sn_list", orderSn);
  url.searchParams.set("response_optional_fields", "buyer_user_id,buyer_username,recipient_address,item_list");

  const res = await fetch(url.toString());
  const body = (await res.json()) as { response?: { order_list?: Array<Record<string, unknown>> } };

  await logIntegration({
    client_id: clientId,
    provider: "shopee",
    operation: "get_order_detail",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
  });

  return body.response?.order_list?.[0] ?? null;
}

export async function updateShopeeOrderStatus(
  orderSn: string,
  status: string,
  accessToken: string,
): Promise<void> {
  const end = startTimer();
  const res = await fetch("https://partner.shopeemobile.com/api/v2/order/update_shipment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_sn: orderSn, status }),
  });

  await logIntegration({
    provider: "shopee",
    operation: "update_order_status",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    metadata: { orderSn, status },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopee order update failed: ${text.slice(0, 200)}`);
  }
}
