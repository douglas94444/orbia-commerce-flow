// Unified order ingestion from marketplace webhooks.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOrder as getMlOrder } from "@/integrations/mercado-livre";
import { decryptToken } from "@/lib/crypto.server";
import { emitNfeForOrder } from "@/modules/fiscal/emit-order-nfe.server";
import { recalculateClientMetrics } from "@/modules/analytics/health-score.server";
import { resolveOrderItemsSkus } from "@/modules/catalog/sku-resolution.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { logAudit } from "@/shared/lib/logger";
import {
  reserveStock,
  releaseStock,
  itemsFromOrderMetadata,
} from "./stock-reservation.server";
import { upsertOrderItems } from "./order-items.server";
import { computeSlaDeadline } from "./sla/sla-engine.server";
import { recordFulfillmentUsage } from "./forecast/volume-forecast.server";
import { normalizeAmazonOrder } from "@/integrations/amazon/orders";
import { normalizeTiktokOrder } from "@/integrations/tiktok/orders";
import { normalizeInstagramOrder } from "@/integrations/instagram/orders";

export type MarketplaceChannel =
  | "nuvemshop"
  | "shopify"
  | "mercado_livre"
  | "shopee"
  | "amazon"
  | "tiktok"
  | "instagram";

export interface NormalizedOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  ncm?: string;
  externalProductId?: string;
  externalVariantId?: string;
}

export interface OrderShipping {
  name?: string;
  cpf?: string;
  cnpj?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface NormalizedOrder {
  externalId: string;
  channel: MarketplaceChannel;
  valueCents: number;
  city: string | null;
  paymentStatus: "paid" | "pending" | "refunded" | "cancelled";
  items: NormalizedOrderItem[];
  customerEmail?: string;
  customerPhone?: string;
  shipping?: OrderShipping;
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

  const order = await getMlOrder(orderId, decryptToken(conn.access_token));
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
    externalProductId: String(p.product_id ?? p.id ?? ""),
    externalVariantId: String(p.variant_id ?? p.id ?? ""),
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
    customerPhone: buyer?.phone ? String(buyer.phone) : undefined,
    shipping: shipping
      ? {
          name: String(buyer?.name ?? shipping.name ?? "Cliente"),
          street: String(shipping.address ?? shipping.street ?? ""),
          number: String(shipping.number ?? "S/N"),
          neighborhood: String(shipping.locality ?? shipping.neighborhood ?? ""),
          city: String(shipping.city ?? ""),
          state: String(shipping.province ?? shipping.state ?? ""),
          postalCode: String(shipping.zipcode ?? shipping.postal_code ?? ""),
        }
      : undefined,
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
    externalProductId: String(p.product_id ?? ""),
    externalVariantId: String(p.variant_id ?? ""),
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
    customerPhone: order.phone ? String(order.phone) : undefined,
    shipping: shipping
      ? {
          name: String(shipping.name ?? order.customer_name ?? "Cliente"),
          street: String(shipping.address1 ?? ""),
          number: String(shipping.address2 ?? "S/N"),
          neighborhood: String(shipping.city ?? ""),
          city: String(shipping.city ?? ""),
          state: String(shipping.province_code ?? shipping.province ?? ""),
          postalCode: String(shipping.zip ?? ""),
        }
      : undefined,
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
    externalProductId: String(p.item?.id ?? ""),
    externalVariantId: String(p.item?.id ?? ""),
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
    customerPhone: buyer?.phone ? String((buyer.phone as { number?: string })?.number ?? buyer.phone) : undefined,
    shipping: receiver
      ? {
          name: String(receiver.receiver_name ?? buyer?.nickname ?? "Cliente"),
          street: String(receiver.street_name ?? ""),
          number: String(receiver.street_number ?? "S/N"),
          neighborhood: String(receiver.neighborhood ?? ""),
          city: String((receiver.city as { name?: string })?.name ?? receiver.city ?? ""),
          state: String((receiver.state as { name?: string })?.name ?? receiver.state ?? ""),
          postalCode: String(receiver.zip_code ?? ""),
        }
      : undefined,
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
    externalProductId: String(p.item_id ?? ""),
    externalVariantId: String(p.model_id ?? p.item_id ?? ""),
  }));

  const recipient = data.recipient_address as Record<string, unknown> | undefined;

  return {
    externalId: String(id),
    channel: "shopee",
    valueCents: Math.round(Number(data.total_amount ?? data.escrow_amount ?? 0) * 100),
    city: recipient?.city ? String(recipient.city) : null,
    paymentStatus: paid ? "paid" : status === "CANCELLED" ? "cancelled" : "pending",
    items: items.length ? items : [{ sku: "SHOPEE-ITEM", name: "Produto Shopee", quantity: 1, unitPriceCents: Math.round(Number(data.total_amount ?? 0) * 100) }],
    customerPhone: recipient?.phone ? String(recipient.phone) : undefined,
    shipping: recipient
      ? {
          name: String(recipient.name ?? "Cliente"),
          street: String(recipient.full_address ?? ""),
          number: "S/N",
          neighborhood: String(recipient.town ?? ""),
          city: String(recipient.city ?? ""),
          state: String(recipient.state ?? ""),
          postalCode: String(recipient.zipcode ?? ""),
        }
      : undefined,
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
    case "amazon":
      return normalizeAmazonOrder(payload);
    case "tiktok":
      return normalizeTiktokOrder(payload);
    case "instagram":
      return normalizeInstagramOrder(payload);
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
  if (order.customerPhone) metadata.customer_phone = order.customerPhone;
  if (order.shipping) {
    metadata.shipping = order.shipping;
    if (order.shipping.postalCode) metadata.postal_code = order.shipping.postalCode;
  }

  const slaDeadline = await computeSlaDeadline(order.channel);

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
        sla_deadline_at: slaDeadline,
        sla_alert_sent: false,
        sla_breached: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,channel,external_id" },
    )
    .select("id, status, nf_status")
    .single();

  if (error) throw new Error(`Order upsert failed: ${error.message}`);

  await upsertOrderItems(data.id, order.items, clientId);
  await recordFulfillmentUsage(clientId, "orders_processed");

  await logAudit({
    user_id: "system",
    client_id: clientId,
    action: "create",
    resource: "order",
    resource_id: data.id,
    new_data: { channel: order.channel, external_id: order.externalId, status },
  });

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
            : provider === "amazon"
              ? String(p.seller_id ?? normalized.raw.seller_id ?? p.marketplace_id ?? "")
              : provider === "tiktok"
                ? String(p.shop_id ?? normalized.raw.shop_id ?? "")
                : provider === "instagram"
                  ? String(p.page_id ?? normalized.raw.page_id ?? p.id ?? "")
                  : String(p.shop_id ?? normalized.raw.shop_id ?? "");

    if (storeId) resolvedClientId = await resolveClientId(provider, storeId);
  }

  if (!resolvedClientId) {
    throw new Error(`No client_id for ${provider} webhook — connect OAuth first`);
  }

  normalized.items = await resolveOrderItemsSkus(resolvedClientId, provider, normalized.items);

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
