// Unified order ingestion from marketplace webhooks.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitNfeForOrder } from "@/modules/fiscal/emit-order-nfe.server";
import { shouldEmitNfce, emitNfceForOrder } from "@/modules/fiscal/emit-nfce.server";
import { shouldEmitNfse, emitNfseForOrder } from "@/modules/fiscal/emit-nfse.server";
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
import { parseCustomerDocumentFromSources } from "@/modules/fiscal/nfe-destinatario.server";
import type { Json } from "@/integrations/supabase/types";

export { enrichMercadoLivrePayload } from "./order-enrichment.server";

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
  cfop?: string;
  cst?: string;
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
  shippingCents?: number;
  discountCents?: number;
  paymentMethod?: string;
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
    externalProductId: String(p.product_id ?? p.id ?? ""),
    externalVariantId: String(p.variant_id ?? p.id ?? ""),
  }));

  const shipping = order.shipping_address as Record<string, unknown> | undefined;
  const buyer = order.customer as Record<string, unknown> | undefined;
  const doc = parseCustomerDocumentFromSources([buyer, order.billing_address, shipping]);

  return {
    externalId: String(id),
    channel: "nuvemshop",
    valueCents: Math.round(Number(order.total ?? order.total_price ?? 0) * 100),
    city: shipping?.city ? String(shipping.city) : null,
    paymentStatus: paid ? "paid" : paymentStatus === "cancelled" ? "cancelled" : "pending",
    items,
    customerEmail: buyer?.email ? String(buyer.email) : undefined,
    customerPhone: buyer?.phone ? String(buyer.phone) : undefined,
    shippingCents: Math.round(Number(order.shipping_cost_customer ?? order.shipping_cost ?? 0) * 100),
    discountCents: Math.round(Number(order.discount ?? order.total_discount ?? 0) * 100),
    paymentMethod: String(
      (order.payment_details as { method?: string } | undefined)?.method ??
        order.gateway ??
        paymentStatus,
    ),
    shipping: shipping
      ? {
          name: String(buyer?.name ?? shipping.name ?? "Cliente"),
          street: String(shipping.address ?? shipping.street ?? ""),
          number: String(shipping.number ?? "S/N"),
          neighborhood: String(shipping.locality ?? shipping.neighborhood ?? ""),
          city: String(shipping.city ?? ""),
          state: String(shipping.province ?? shipping.state ?? ""),
          postalCode: String(shipping.zipcode ?? shipping.postal_code ?? ""),
          cpf: doc.cpf,
          cnpj: doc.cnpj,
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
  const doc = parseCustomerDocumentFromSources([
    order.billing_address,
    order.customer,
    shipping,
    (order.note_attributes as unknown[]) ?? [],
  ]);

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
    shippingCents: Math.round(
      Number(
        (order.total_shipping_price_set as { shop_money?: { amount?: string } } | undefined)
          ?.shop_money?.amount ??
          (order.shipping_lines as Array<{ price?: string }> | undefined)?.[0]?.price ??
          0,
      ) * 100,
    ),
    discountCents: Math.round(Number(order.total_discounts ?? 0) * 100),
    paymentMethod: String((order.payment_gateway_names as string[] | undefined)?.[0] ?? financial),
    shipping: shipping
      ? {
          name: String(shipping.name ?? order.customer_name ?? "Cliente"),
          street: String(shipping.address1 ?? ""),
          number: String(shipping.address2 ?? "S/N"),
          neighborhood: String(shipping.city ?? ""),
          city: String(shipping.city ?? ""),
          state: String(shipping.province_code ?? shipping.province ?? ""),
          postalCode: String(shipping.zip ?? ""),
          cpf: doc.cpf,
          cnpj: doc.cnpj,
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
  const doc = parseCustomerDocumentFromSources([
    buyer,
    data.billing,
    receiver,
    buyer?.billing_info,
    buyer?.identification,
  ]);
  const itemsSubtotal = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const totalCents = Math.round(Number(data.total_amount ?? data.paid_amount ?? 0) * 100);
  const shippingCents = Math.max(0, totalCents - itemsSubtotal);

  return {
    externalId: String(id),
    channel: "mercado_livre",
    valueCents: totalCents,
    city: receiver?.city ? String((receiver.city as { name?: string })?.name ?? receiver.city) : null,
    paymentStatus: paid ? "paid" : status === "cancelled" ? "cancelled" : "pending",
    items: items.length ? items : [{ sku: "ML-ITEM", name: "Produto ML", quantity: 1, unitPriceCents: Math.round(Number(data.total_amount ?? 0) * 100) }],
    customerEmail: buyer?.email ? String(buyer.email) : undefined,
    customerPhone: buyer?.phone ? String((buyer.phone as { number?: string })?.number ?? buyer.phone) : undefined,
    shippingCents,
    paymentMethod: String((data.payments as Array<{ payment_type?: string }> | undefined)?.[0]?.payment_type ?? "marketplace"),
    shipping: receiver
      ? {
          name: String(receiver.receiver_name ?? buyer?.nickname ?? "Cliente"),
          street: String(receiver.street_name ?? ""),
          number: String(receiver.street_number ?? "S/N"),
          neighborhood: String(receiver.neighborhood ?? ""),
          city: String((receiver.city as { name?: string })?.name ?? receiver.city ?? ""),
          state: String((receiver.state as { name?: string })?.name ?? receiver.state ?? ""),
          postalCode: String(receiver.zip_code ?? ""),
          cpf: doc.cpf,
          cnpj: doc.cnpj,
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
  const doc = parseCustomerDocumentFromSources([data, recipient, data.buyer_cpf_id, data.buyer_tax_id]);
  const itemsSubtotal = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const totalCents = Math.round(Number(data.total_amount ?? data.escrow_amount ?? 0) * 100);

  return {
    externalId: String(id),
    channel: "shopee",
    valueCents: totalCents,
    city: recipient?.city ? String(recipient.city) : null,
    paymentStatus: paid ? "paid" : status === "CANCELLED" ? "cancelled" : "pending",
    items: items.length ? items : [{ sku: "SHOPEE-ITEM", name: "Produto Shopee", quantity: 1, unitPriceCents: Math.round(Number(data.total_amount ?? 0) * 100) }],
    customerPhone: recipient?.phone ? String(recipient.phone) : undefined,
    shippingCents: Math.max(0, totalCents - itemsSubtotal),
    paymentMethod: String(data.payment_method ?? "marketplace"),
    shipping: recipient
      ? {
          name: String(recipient.name ?? "Cliente"),
          street: String(recipient.full_address ?? ""),
          number: "S/N",
          neighborhood: String(recipient.town ?? ""),
          city: String(recipient.city ?? ""),
          state: String(recipient.state ?? ""),
          postalCode: String(recipient.zipcode ?? ""),
          cpf: doc.cpf,
          cnpj: doc.cnpj,
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
  if (order.shippingCents != null) metadata.shipping_cents = order.shippingCents;
  if (order.discountCents != null) metadata.discount_cents = order.discountCents;
  if (order.paymentMethod) metadata.payment_method = order.paymentMethod;
  if (order.customerEmail) metadata.customer_email = order.customerEmail;
  if (order.customerPhone) metadata.customer_phone = order.customerPhone;
  if (order.shipping) {
    metadata.shipping = order.shipping;
    if (order.shipping.postalCode) metadata.postal_code = order.shipping.postalCode;
    if (order.shipping.cpf) metadata.customer_document = order.shipping.cpf;
    else if (order.shipping.cnpj) metadata.customer_document = order.shipping.cnpj;
  }

  if (order.raw.tiktok_origin) metadata.tiktok_origin = order.raw.tiktok_origin;
  if (order.raw.fulfillment_type) metadata.fulfillment_type = order.raw.fulfillment_type;

  const { extractAttributionSignals, buildAttributionMeta } = await import(
    "@/modules/traffic/order-attribution.server"
  );
  const attributionSignals = extractAttributionSignals(order.raw, metadata);
  metadata.attribution = buildAttributionMeta(attributionSignals);

  const rawCoupon =
    order.raw.coupon_code ??
    order.raw.discount_coupon ??
    (order.raw.coupons as Array<Record<string, unknown>> | undefined)?.[0]?.code ??
    (order.raw.discount_codes as Array<Record<string, unknown>> | undefined)?.[0]?.code;
  if (rawCoupon) metadata.coupon_code = String(rawCoupon).toUpperCase();
  metadata.raw = order.raw;

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, status, nf_status, metadata, channel")
    .eq("client_id", clientId)
    .eq("channel", order.channel)
    .eq("external_id", order.externalId)
    .maybeSingle();

  let data: { id: string; status: string; nf_status: string };

  if (existing) {
    const prevMeta = (existing.metadata ?? {}) as Record<string, unknown>;
    const mergedMetadata = { ...prevMeta, ...metadata };
    const updatePayload: Record<string, unknown> = {
      value_cents: order.valueCents,
      city: order.city,
      metadata: mergedMetadata,
      updated_at: new Date().toISOString(),
    };

    if (order.paymentStatus === "cancelled" || order.paymentStatus === "refunded") {
      updatePayload.status = "cancelado";
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", existing.id)
      .select("id, status, nf_status")
      .single();

    if (updateErr) throw new Error(`Order update failed: ${updateErr.message}`);
    data = updated;
  } else {
    const slaDeadline = await computeSlaDeadline(order.channel, clientId);
    const { data: inserted, error } = await supabaseAdmin
      .from("orders")
      .insert({
        client_id: clientId,
        external_id: order.externalId,
        channel: order.channel,
        status,
        nf_status: "pendente",
        value_cents: order.valueCents,
        city: order.city,
        metadata: metadata as Json,
        sla_deadline_at: slaDeadline,
        sla_alert_sent: false,
        sla_breached: false,
      })
      .select("id, status, nf_status")
      .single();

    if (error) throw new Error(`Order insert failed: ${error.message}`);
    data = inserted;
  }

  await upsertOrderItems(data.id, order.items, clientId);
  await recordFulfillmentUsage(clientId, "orders_processed");

  const { captureAttributionOnIngest } = await import(
    "@/modules/traffic/order-attribution.server"
  );
  await captureAttributionOnIngest(clientId, data.id, order).catch(() => undefined);

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
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("client_id, nf_status, channel, metadata")
    .eq("id", orderId)
    .single();

  if (!order) return;
  if (order.nf_status === "autorizada") return;

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;

  const { validateFiscalReadiness } = await import("@/modules/fiscal/fiscal-readiness.server");
  const docType = shouldEmitNfse(metadata)
    ? "nfse"
    : shouldEmitNfce(order.channel, metadata)
      ? "nfce"
      : "nfe";

  const readiness = await validateFiscalReadiness(order.client_id, {
    attemptFocusSync: true,
    docType,
  });
  if (!readiness.ready) {
    const keys = readiness.items.filter((i) => i.status === "error").map((i) => i.key);
    console.warn(`[fiscal] NF não disparada para pedido ${orderId}: config incompleta`, keys);
    await supabaseAdmin
      .from("orders")
      .update({
        metadata: { ...metadata, nfe_blocked_reason: keys.join(", ") },
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    return;
  }

  try {
    if (shouldEmitNfse(metadata)) {
      await emitNfseForOrder(orderId);
    } else if (shouldEmitNfce(order.channel, metadata)) {
      await emitNfceForOrder(orderId);
    } else {
      await emitNfeForOrder(orderId);
    }
  } catch (err) {
    console.error(`[fiscal] emission failed for ${orderId}:`, (err as Error).message);
  }
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

  let enrichedPayload = payload;
  try {
    const { enrichOrderPayload } = await import("./order-enrichment.server");
    enrichedPayload = await enrichOrderPayload(provider, payload, clientId);
  } catch (err) {
    console.error(`[ingest/${provider}] enrich error:`, err);
  }

  const normalized = normalizeByProvider(provider, enrichedPayload);
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

    const { handleChannelCancellation } = await import("./channel-cancellation.server");
    await handleChannelCancellation({
      clientId: resolvedClientId,
      channel: provider,
      externalOrderId: normalized.externalId,
      reason: normalized.paymentStatus,
    }).catch(() => undefined);
  }

  const orderId = await upsertOrderFromWebhook(resolvedClientId, normalized);

  if (normalized.paymentStatus === "paid") {
    const { syncCustomerFromOrderMetadata } = await import("@/modules/retention/customer-sync.server");
    await syncCustomerFromOrderMetadata(orderId).catch((err) =>
      console.error("[ingest] customer sync:", err),
    );

    const { snapshotOrderFees } = await import("@/modules/marketplaces/channel-profitability.server");
    await snapshotOrderFees(
      resolvedClientId,
      orderId,
      provider,
      normalized.valueCents,
      normalized.raw,
    ).catch((err) => console.error("[ingest] fee snapshot:", err));

    await reserveStock(resolvedClientId, stockItems);
    await emitDomainEvent("order.paid", {
      orderId,
      clientId: resolvedClientId,
      items: stockItems,
    });
    await triggerNfeForOrder(orderId);
    await recalculateClientMetrics(resolvedClientId);

    if (provider === "instagram") {
      const { linkMetaAdsAttribution } = await import("@/modules/marketplaces/instagram-commerce.server");
      await linkMetaAdsAttribution(resolvedClientId, orderId).catch((err) =>
        console.error("[ingest/instagram] meta ads attribution:", err),
      );
    }
  }
}
