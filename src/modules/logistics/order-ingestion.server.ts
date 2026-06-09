// Unified order ingestion from marketplace webhooks.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOrder as getMlOrder } from "@/integrations/mercado-livre";
import { emitNfeForOrder } from "@/modules/fiscal/emit-order-nfe.server";
import { recalculateClientMetrics } from "@/modules/analytics/health-score.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import {
  reserveStock,
  releaseStock,
  itemsFromOrderMetadata,
} from "./stock-reservation.server";

export type MarketplaceChannel =
  | "nuvemshop"
  | "shopify"
  | "mercado_livre"
  | "shopee";

export interface NormalizedOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  ncm?: string;
}

export interface NormalizedOrder {
  externalId: string;
  channel: MarketplaceChannel;
  valueCents: number;
  city: string | null;
  paymentStatus: "paid" | "pending" | "refunded" | "cancelled";
  items: NormalizedOrderItem[];
  customerEmail?: string;
  raw: Record<string, unknown>;
}

export async function enrichMercadoLivrePayload(payload: unknown): Promise<unknown> {
  const body = payload as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;
  if (data.order_items) return payload;

  const resource = String(body.resource ?? "");
  const orderId = resource.split("/").pop();
  const userId = String(body.user_id ?? "");
  if (!orderId || !userId) return payload;

  const clientId = await resolveClientId("mercado_livre", userId);
  if (!clientId) return payload;

  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token")
    .eq("client_id", clientId)
    .eq("provider", "mercado_livre")
    .eq("external_account", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return payload;

  const order = await getMlOrder(orderId, conn.access_token);
  return { ...body, data: order, user_id: userId };
}

export async function resolveClientId(
  provider: string,
  externalAccount: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("client_id")
    .eq("provider", provider)
    .eq("external_account", externalAccount)
    .eq("is_active", true)
    .maybeSingle();

  return data?.client_id ?? null;
}

export function normalizeNuvemshopOrder(payload: unknown): NormalizedOrder | null {
  const body = payload as Record<string, unknown>;
  const order = (body.data ?? body) as Record<string, unknown>;
  const id = order.id ?? body.id;
  if (id == null) return null;

  const paymentStatus = String(order.payment_status ?? order.status ?? "").toLowerCase();
  const paid = paymentStatus === "paid" || paymentStatus === "authorized";

  const products = (order.products ?? order.line_items ?? []) as Array<Record<string, unknown>>;
  const items: NormalizedOrderItem[] = products.map((p) => ({
    sku: String(p.sku ?? p.variant_id ?? p.product_id ?? "SKU"),
    name: String(p.name ?? p.title ?? "Produto"),
    quantity: Number(p.quantity ?? 1),
    unitPriceCents: Math.round(Number(p.price ?? p.unit_price ?? 0) * 100),
    ncm: p.ncm ? String(p.ncm) : undefined,
  }));

  const shipping = order.shipping_address as Record<string, unknown> | undefined;
  const buyer = order.customer as Record<string, unknown> | undefined;

  return {
    externalId: String(id),
    channel: "nuvemshop",
    valueCents: Math.round(Number(order.total ?? order.total_price ?? 0) * 100),
    city: shipping?.city ? String(shipping.city) : null,
    paymentStatus: paid ? "paid" : paymentStatus === "cancelled" ? "cancelled" : "pending",
    items,
    customerEmail: buyer?.email ? String(buyer.email) : undefined,
    raw: order as Record<string, unknown>,
  };
}

export function normalizeShopifyOrder(payload: unknown): NormalizedOrder | null {
  const order = payload as Record<string, unknown>;
  const id = order.id;
  if (id == null) return null;

  const financial = String(order.financial_status ?? "").toLowerCase();
  const paid = financial === "paid" || financial === "partially_paid";

  const lineItems = (order.line_items ?? []) as Array<Record<string, unknown>>;
  const items: NormalizedOrderItem[] = lineItems.map((p) => ({
    sku: String(p.sku ?? p.variant_id ?? "SKU"),
    name: String(p.name ?? p.title ?? "Produto"),
    quantity: Number(p.quantity ?? 1),
    unitPriceCents: Math.round(Number(p.price ?? 0) * 100),
  }));

  const shipping = order.shipping_address as Record<string, unknown> | undefined;

  return {
    externalId: String(id),
    channel: "shopify",
    valueCents: Math.round(Number(order.total_price ?? 0) * 100),
    city: shipping?.city ? String(shipping.city) : null,
    paymentStatus: paid
      ? "paid"
      : financial === "refunded"
        ? "refunded"
        : financial === "voided"
          ? "cancelled"
          : "pending",
    items,
    customerEmail: order.email ? String(order.email) : undefined,
    raw: order as Record<string, unknown>,
  };
}

export function normalizeMercadoLivreOrder(payload: unknown): NormalizedOrder | null {
  const body = payload as Record<string, unknown>;
  const order = (body.resource ? body : body) as Record<string, unknown>;
  const data = (order.data ?? order) as Record<string, unknown>;

  const id = data.id ?? body.id;
  if (id == null) return null;

  const status = String(data.status ?? "").toLowerCase();
  const paid = status === "paid" || status === "confirmed";

  const orderItems = (data.order_items ?? []) as Array<Record<string, unknown>>;
  const items: NormalizedOrderItem[] = orderItems.map((p) => ({
    sku: String(p.item?.seller_sku ?? p.item?.id ?? "SKU"),
    name: String(p.item?.title ?? "Produto"),
    quantity: Number(p.quantity ?? 1),
    unitPriceCents: Math.round(Number(p.unit_price ?? 0) * 100),
  }));

  const shipping = data.shipping as Record<string, unknown> | undefined;
  const receiver = shipping?.receiver_address as Record<string, unknown> | undefined;
  const buyer = data.buyer as Record<string, unknown> | undefined;

  return {
    externalId: String(id),
    channel: "mercado_livre",
    valueCents: Math.round(Number(data.total_amount ?? data.paid_amount ?? 0) * 100),
    city: receiver?.city ? String((receiver.city as { name?: string })?.name ?? receiver.city) : null,
    paymentStatus: paid ? "paid" : status === "cancelled" ? "cancelled" : "pending",
    items: items.length ? items : [{ sku: "ML-ITEM", name: "Produto ML", quantity: 1, unitPriceCents: Math.round(Number(data.total_amount ?? 0) * 100) }],
    customerEmail: buyer?.email ? String(buyer.email) : undefined,
    raw: data as Record<string, unknown>,
  };
}

export function normalizeShopeeOrder(payload: unknown): NormalizedOrder | null {
  const body = payload as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;

  const id = data.order_sn ?? data.ordersn ?? data.order_id;
  if (id == null) return null;

  const status = String(data.order_status ?? "").toUpperCase();
  const paid = ["READY_TO_SHIP", "PROCESSED", "SHIPPED", "COMPLETED", "TO_CONFIRM_RECEIVE"].includes(status);

  const itemList = (data.item_list ?? []) as Array<Record<string, unknown>>;
  const items: NormalizedOrderItem[] = itemList.map((p) => ({
    sku: String(p.item_sku ?? p.model_sku ?? p.item_id ?? "SKU"),
    name: String(p.item_name ?? "Produto"),
    quantity: Number(p.model_quantity_purchased ?? p.quantity ?? 1),
    unitPriceCents: Math.round(Number(p.model_discounted_price ?? p.model_original_price ?? 0) * 100),
  }));

  const recipient = data.recipient_address as Record<string, unknown> | undefined;

  return {
    externalId: String(id),
    channel: "shopee",
    valueCents: Math.round(Number(data.total_amount ?? data.escrow_amount ?? 0) * 100),
    city: recipient?.city ? String(recipient.city) : null,
    paymentStatus: paid ? "paid" : status === "CANCELLED" ? "cancelled" : "pending",
    items: items.length ? items : [{ sku: "SHOPEE-ITEM", name: "Produto Shopee", quantity: 1, unitPriceCents: Math.round(Number(data.total_amount ?? 0) * 100) }],
    customerEmail: data.buyer_username ? undefined : undefined,
    raw: data as Record<string, unknown>,
  };
}

function normalizeByProvider(provider: MarketplaceChannel, payload: unknown): NormalizedOrder | null {
  switch (provider) {
    case "nuvemshop":
      return normalizeNuvemshopOrder(payload);
    case "shopify":
      return normalizeShopifyOrder(payload);
    case "mercado_livre":
      return normalizeMercadoLivreOrder(payload);
    case "shopee":
      return normalizeShopeeOrder(payload);
  }
}

export async function upsertOrderFromWebhook(
  clientId: string,
  order: NormalizedOrder,
): Promise<string> {
  const status =
    order.paymentStatus === "cancelled" || order.paymentStatus === "refunded"
      ? "cancelado"
      : "aguardando_nf";

  const metadata: Record<string, unknown> = {
    items: order.items,
    payment_status: order.paymentStatus,
    raw_id: order.externalId,
  };
  if (order.customerEmail) metadata.customer_email = order.customerEmail;

  const { data, error } = await supabaseAdmin
    .from("orders")
    .upsert(
      {
        client_id: clientId,
        external_id: order.externalId,
        channel: order.channel,
        status,
        nf_status: "pendente",
        value_cents: order.valueCents,
        city: order.city,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,channel,external_id" },
    )
    .select("id, status, nf_status")
    .single();

  if (error) throw new Error(`Order upsert failed: ${error.message}`);

  await supabaseAdmin.from("order_events").insert({
    order_id: data.id,
    status: data.status,
    source: order.channel,
    metadata: { event: "webhook_ingest", payment_status: order.paymentStatus },
  });

  return data.id;
}

export async function triggerNfeForOrder(orderId: string): Promise<void> {
  await emitNfeForOrder(orderId);
}

export async function ingestStoreWebhook(
  provider: MarketplaceChannel,
  eventType: string,
  payload: unknown,
  clientId: string | null,
): Promise<void> {
  const relevantEvents = new Set([
    "order/paid",
    "orders/paid",
    "order/updated",
    "orders/updated",
    "orders/create",
    "order/created",
    "orders_v2",
    "payment",
    "order_status_push",
    "created_orders",
  ]);

  if (!relevantEvents.has(eventType)) return;

  const normalized = normalizeByProvider(provider, payload);
  if (!normalized) throw new Error(`Could not normalize ${provider} order payload`);

  let resolvedClientId = clientId;
  if (!resolvedClientId) {
    const p = payload as Record<string, unknown>;
    const storeId =
      provider === "nuvemshop"
        ? String(p.store_id ?? normalized.raw.store_id ?? "")
        : provider === "shopify"
          ? String(p.shop_domain ?? normalized.raw.shop_domain ?? "")
          : provider === "mercado_livre"
            ? String(p.user_id ?? normalized.raw.seller?.id ?? "")
            : String(p.shop_id ?? normalized.raw.shop_id ?? "");

    if (storeId) resolvedClientId = await resolveClientId(provider, storeId);
  }

  if (!resolvedClientId) {
    throw new Error(`No client_id for ${provider} webhook — connect OAuth first`);
  }

  const stockItems = itemsFromOrderMetadata(normalized.items);

  if (normalized.paymentStatus === "cancelled" || normalized.paymentStatus === "refunded") {
    try {
      await releaseStock(resolvedClientId, stockItems);
    } catch {
      // May not have been reserved yet
    }
  }

  const orderId = await upsertOrderFromWebhook(resolvedClientId, normalized);

  if (normalized.paymentStatus === "paid") {
    await reserveStock(resolvedClientId, stockItems);
    await emitDomainEvent("order.paid", { orderId, clientId: resolvedClientId });
    await triggerNfeForOrder(orderId);
    await recalculateClientMetrics(resolvedClientId);
  }
}
