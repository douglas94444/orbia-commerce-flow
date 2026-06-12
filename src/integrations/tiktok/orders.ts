import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import type {
  NormalizedOrder,
  NormalizedOrderItem,
} from "@/modules/logistics/order-ingestion.server";

export async function fetchTiktokOrder(
  clientId: string,
  orderId: string,
): Promise<Record<string, unknown> | null> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account")
    .eq("client_id", clientId)
    .eq("provider", "tiktok")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return null;
  const token = decryptToken(conn.access_token);
  const shopId = conn.external_account ?? "";

  const res = await fetch(
    "https://open-api.tiktokglobalshop.com/order/202309/orders",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-tts-access-token": token,
      },
      body: JSON.stringify({
        shop_id: shopId,
        ids: [orderId],
      }),
    },
  );

  if (!res.ok) return null;

  const body = (await res.json()) as {
    data?: { orders?: Array<Record<string, unknown>> };
  };
  return body.data?.orders?.[0] ?? null;
}

export function normalizeTiktokOrder(payload: unknown): NormalizedOrder | null {
  const body = payload as Record<string, unknown>;
  const data = (body.data ?? body.order ?? body) as Record<string, unknown>;

  const orderId = data.order_id ?? data.id ?? data.order_sn;
  if (!orderId) return null;

  const status = String(data.order_status ?? data.status ?? "").toUpperCase();
  const paid = ["AWAITING_SHIPMENT", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(status);
  const cancelled = status === "CANCELLED";

  const lineItems = (data.line_items ?? data.item_list ?? []) as Array<Record<string, unknown>>;
  const items: NormalizedOrderItem[] = lineItems.map((item) => ({
    sku: String(item.seller_sku ?? item.sku ?? item.product_id ?? "TT-SKU"),
    name: String(item.product_name ?? item.name ?? "Produto TikTok"),
    quantity: Number(item.quantity ?? 1),
    unitPriceCents: Math.round(Number(item.sale_price ?? item.price ?? 0) * 100),
    externalProductId: String(item.product_id ?? ""),
  }));

  const addr = (data.recipient_address ?? data.shipping_info ?? {}) as Record<string, unknown>;

  return {
    externalId: String(orderId),
    channel: "tiktok",
    valueCents: Math.round(Number(data.payment_total ?? data.total_amount ?? 0) * 100),
    city: addr.city ? String(addr.city) : null,
    paymentStatus: cancelled ? "cancelled" : paid ? "paid" : "pending",
    items: items.length
      ? items
      : [{ sku: "TT-ITEM", name: "Produto TikTok", quantity: 1, unitPriceCents: 0 }],
    customerPhone: addr.phone ? String(addr.phone) : undefined,
    shipping: {
      name: String(addr.name ?? "Cliente TikTok"),
      street: String(addr.full_address ?? addr.address ?? ""),
      number: "S/N",
      neighborhood: String(addr.district ?? ""),
      city: String(addr.city ?? ""),
      state: String(addr.state ?? ""),
      postalCode: String(addr.zipcode ?? addr.postal_code ?? ""),
    },
    raw: data,
  };
}

export async function updateTiktokShipmentStatus(
  orderId: string,
  status: string,
  token: string,
): Promise<void> {
  const res = await fetch("https://open-api.tiktokglobalshop.com/api/orders/ship", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, shipping_status: status }),
  });
  if (!res.ok) throw new Error(`TikTok shipment update failed: ${res.status}`);
}
