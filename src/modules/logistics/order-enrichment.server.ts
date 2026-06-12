import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { getOrder as getMlOrder } from "@/integrations/mercado-livre";
import { resolveClientId } from "./order-ingestion.server";
import type { MarketplaceChannel } from "./order-ingestion.server";

export async function enrichOrderPayload(
  provider: MarketplaceChannel,
  payload: unknown,
  clientId?: string | null,
): Promise<unknown> {
  switch (provider) {
    case "mercado_livre":
      return enrichMercadoLivrePayload(payload);
    case "shopee":
      return enrichShopeePayload(payload, clientId);
    case "amazon":
      return enrichAmazonPayload(payload, clientId);
    case "tiktok":
      return enrichTiktokPayload(payload, clientId);
    default:
      return payload;
  }
}

export async function enrichMercadoLivrePayload(payload: unknown): Promise<unknown> {
  const body = payload as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;
  if (data.order_items) return payload;

  const resource = String(body.resource ?? "");
  const orderId = resource.split("/").pop();
  const userId = String(body.user_id ?? "");
  if (!orderId || !userId) return payload;

  const resolvedClientId = await resolveClientId("mercado_livre", userId);
  if (!resolvedClientId) return payload;

  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token")
    .eq("client_id", resolvedClientId)
    .eq("provider", "mercado_livre")
    .eq("external_account", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return payload;

  const order = await getMlOrder(orderId, decryptToken(conn.access_token));
  return { ...body, data: order, user_id: userId };
}

async function enrichShopeePayload(
  payload: unknown,
  clientId?: string | null,
): Promise<unknown> {
  const body = payload as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;
  if (data.item_list || data.order_items) return payload;

  const orderSn = String(data.order_sn ?? body.order_sn ?? "");
  const shopId = String(data.shop_id ?? body.shop_id ?? "");
  if (!orderSn) return payload;

  const resolvedClientId =
    clientId ?? (shopId ? await resolveClientId("shopee", shopId) : null);
  if (!resolvedClientId) return payload;

  const { getShopeeOrderDetail } = await import("@/integrations/shopee/orders");
  const order = await getShopeeOrderDetail(resolvedClientId, orderSn);
  if (!order) return payload;

  return { ...body, data: order, shop_id: shopId };
}

async function enrichAmazonPayload(
  payload: unknown,
  clientId?: string | null,
): Promise<unknown> {
  const body = payload as Record<string, unknown>;
  const inner = (body.payload ?? body) as Record<string, unknown>;
  if (inner.OrderItems || inner.order_items) return payload;

  const orderId = String(
    inner.AmazonOrderId ?? inner.amazon_order_id ?? inner.OrderId ?? "",
  );
  if (!orderId || !clientId) return payload;

  const { fetchAmazonOrder } = await import("@/integrations/amazon/orders");
  const order = await fetchAmazonOrder(clientId, orderId);
  if (!order) return payload;

  return { ...body, Order: order, payload: order };
}

async function enrichTiktokPayload(
  payload: unknown,
  clientId?: string | null,
): Promise<unknown> {
  const body = payload as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;
  if (data.line_items?.length) return payload;

  const orderId = String(data.order_id ?? data.id ?? "");
  const shopId = String(data.shop_id ?? body.shop_id ?? "");
  if (!orderId) return payload;

  const resolvedClientId =
    clientId ?? (shopId ? await resolveClientId("tiktok", shopId) : null);
  if (!resolvedClientId) return payload;

  const { fetchTiktokOrder } = await import("@/integrations/tiktok/orders");
  const order = await fetchTiktokOrder(resolvedClientId, orderId);
  if (!order) return payload;

  return { ...body, data: order, shop_id: shopId };
}
