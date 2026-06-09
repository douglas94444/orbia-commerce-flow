// Unified order ingestion from Nuvemshop / Shopify webhooks.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitNfeForOrder } from "@/modules/fiscal/emit-order-nfe.server";

export interface NormalizedOrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  ncm?: string;
}

export interface NormalizedOrder {
  externalId: string;
  channel: "nuvemshop" | "shopify";
  valueCents: number;
  city: string | null;
  paymentStatus: "paid" | "pending" | "refunded" | "cancelled";
  items: NormalizedOrderItem[];
  raw: Record<string, unknown>;
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
  const total = Number(order.total ?? order.total_price ?? 0);

  return {
    externalId: String(id),
    channel: "nuvemshop",
    valueCents: Math.round(total * 100),
    city: shipping?.city ? String(shipping.city) : null,
    paymentStatus: paid ? "paid" : paymentStatus === "cancelled" ? "cancelled" : "pending",
    items,
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
  const total = Number(order.total_price ?? 0);

  return {
    externalId: String(id),
    channel: "shopify",
    valueCents: Math.round(total * 100),
    city: shipping?.city ? String(shipping.city) : null,
    paymentStatus: paid
      ? "paid"
      : financial === "refunded"
        ? "refunded"
        : financial === "voided"
          ? "cancelled"
          : "pending",
    items,
    raw: order as Record<string, unknown>,
  };
}

export async function upsertOrderFromWebhook(
  clientId: string,
  order: NormalizedOrder,
): Promise<string> {
  const status =
    order.paymentStatus === "cancelled" || order.paymentStatus === "refunded"
      ? "cancelado"
      : "aguardando_nf";

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
        metadata: {
          items: order.items,
          payment_status: order.paymentStatus,
          raw_id: order.externalId,
        },
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
  provider: "nuvemshop" | "shopify",
  eventType: string,
  payload: unknown,
  clientId: string | null,
): Promise<void> {
  const paidEvents = new Set([
    "order/paid",
    "orders/paid",
    "order/updated",
    "orders/updated",
    "orders/create",
    "order/created",
  ]);

  if (!paidEvents.has(eventType)) return;

  const normalized =
    provider === "nuvemshop" ? normalizeNuvemshopOrder(payload) : normalizeShopifyOrder(payload);

  if (!normalized) throw new Error(`Could not normalize ${provider} order payload`);

  let resolvedClientId = clientId;
  if (!resolvedClientId) {
    const storeId =
      provider === "nuvemshop"
        ? String((payload as Record<string, unknown>).store_id ?? normalized.raw.store_id ?? "")
        : String(
            (payload as Record<string, unknown>).shop_domain ?? normalized.raw.shop_domain ?? "",
          );

    if (storeId) resolvedClientId = await resolveClientId(provider, storeId);
  }

  if (!resolvedClientId) {
    throw new Error(`No client_id for ${provider} webhook — connect OAuth first`);
  }

  const orderId = await upsertOrderFromWebhook(resolvedClientId, normalized);

  if (normalized.paymentStatus === "paid") {
    await triggerNfeForOrder(orderId);
  }
}
