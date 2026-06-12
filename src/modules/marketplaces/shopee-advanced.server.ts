import { createHmac } from "node:crypto";
import { getServerConfig } from "@/lib/config.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { sendWhatsAppToClient } from "@/modules/logistics/notifications/whatsapp-alerts.server";
import { enrollInSequence } from "@/modules/retention/enrollment.server";
import { snapshotOrderFees } from "./channel-profitability.server";
import { getMarketplaceConnection } from "./_oauth.server";

const API_HOST = "https://partner.shopeemobile.com";

function signShopee(path: string, timestamp: number, accessToken: string, shopId: string): string {
  const { shopee } = getServerConfig();
  const base = `${shopee.partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac("sha256", shopee.partnerKey ?? "").update(base).digest("hex");
}

async function shopeeApiGet<T>(
  clientId: string,
  path: string,
  extraParams: Record<string, string> = {},
): Promise<T | null> {
  const conn = await getMarketplaceConnection(clientId, "shopee");
  if (!conn?.externalAccount) return null;

  const shopId = conn.externalAccount;
  const timestamp = Math.floor(Date.now() / 1000);
  const end = startTimer();

  const url = new URL(`${API_HOST}${path}`);
  url.searchParams.set("partner_id", getServerConfig().shopee.partnerId ?? "");
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signShopee(path, timestamp, conn.accessToken, shopId));
  url.searchParams.set("shop_id", shopId);
  url.searchParams.set("access_token", conn.accessToken);
  for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  const body = (await res.json()) as T;

  await logIntegration({
    client_id: clientId,
    provider: "shopee",
    operation: path,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
  });

  return res.ok ? body : null;
}

export interface ShopeePenaltyMetrics {
  lateShipmentRate: number;
  cancellationRate: number;
  returnRate: number;
  penaltyPoints: number;
}

export interface ShopeeShopScore {
  overall: number;
  fulfillment: number;
  customerService: number;
  listing: number;
}

export interface ShopeePromotion {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface ShopeeOrderFeeBreakdown {
  commissionCents: number;
  serviceFeeCents: number;
  shippingSubsidyCents: number;
  totalFeeCents: number;
}

export interface ShopeeSlaAlert {
  orderSn: string;
  hoursLeft: number;
  clientId: string;
}

export async function checkShopeeSlaAlerts(clientId?: string): Promise<{
  alertsSent: number;
  ordersChecked: number;
}> {
  let alertsSent = 0;
  let ordersChecked = 0;

  let query = supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, sla_deadline_at, metadata")
    .eq("channel", "shopee")
    .in("status", ["separacao", "em_picking", "em_packing", "aguardando_nf"])
    .not("sla_deadline_at", "is", null);

  if (clientId) query = query.eq("client_id", clientId);

  const { data: orders } = await query.limit(100);
  const now = Date.now();

  for (const order of orders ?? []) {
    ordersChecked += 1;
    const deadline = new Date(order.sla_deadline_at as string).getTime();
    const hoursLeft = (deadline - now) / 3_600_000;
    if (hoursLeft > 4 || hoursLeft <= 0) continue;

    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    if (meta.shopee_sla_4h_alert_sent) continue;

    const cid = order.client_id as string;
    await sendWhatsAppToClient(
      cid,
      `⚠️ Shopee SLA: pedido ${order.external_id} vence em ${Math.round(hoursLeft)}h. Despache antes do prazo para evitar penalidade.`,
    );

    await supabaseAdmin.from("operation_alerts").insert({
      client_id: cid,
      kind: "sla",
      severity: "critical",
      title: "Shopee — SLA 4h",
      message: `Pedido ${order.external_id} com prazo em ${Math.round(hoursLeft)}h`,
      is_resolved: false,
    });

    await supabaseAdmin
      .from("orders")
      .update({
        metadata: { ...meta, shopee_sla_4h_alert_sent: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    alertsSent += 1;
  }

  return { alertsSent, ordersChecked };
}

export async function fetchShopeePenaltyMetrics(
  clientId: string,
): Promise<ShopeePenaltyMetrics | null> {
  const res = await shopeeApiGet<{
    response?: {
      late_shipment_rate?: number;
      cancellation_rate?: number;
      return_rate?: number;
      penalty_points?: number;
    };
  }>(clientId, "/api/v2/shop/get_shop_performance");

  const perf = res?.response;
  if (!perf) return null;

  return {
    lateShipmentRate: perf.late_shipment_rate ?? 0,
    cancellationRate: perf.cancellation_rate ?? 0,
    returnRate: perf.return_rate ?? 0,
    penaltyPoints: perf.penalty_points ?? 0,
  };
}

export async function fetchShopeeShopScore(clientId: string): Promise<ShopeeShopScore | null> {
  const res = await shopeeApiGet<{
    response?: {
      overall_score?: number;
      fulfillment_score?: number;
      customer_service_score?: number;
      listing_score?: number;
    };
  }>(clientId, "/api/v2/shop/get_shop_score");

  const s = res?.response;
  if (!s) return null;

  return {
    overall: s.overall_score ?? 0,
    fulfillment: s.fulfillment_score ?? 0,
    customerService: s.customer_service_score ?? 0,
    listing: s.listing_score ?? 0,
  };
}

export async function fetchShopeePromotions(clientId: string): Promise<ShopeePromotion[]> {
  const res = await shopeeApiGet<{
    response?: {
      promotion_list?: Array<{
        promotion_id?: number;
        promotion_name?: string;
        start_time?: number;
        end_time?: number;
        status?: string;
      }>;
    };
  }>(clientId, "/api/v2/discount/get_discount_list", { page_size: "50" });

  return (res?.response?.promotion_list ?? []).map((p) => ({
    id: String(p.promotion_id ?? ""),
    name: p.promotion_name ?? "Promoção",
    startTime: p.start_time ? new Date(p.start_time * 1000).toISOString() : "",
    endTime: p.end_time ? new Date(p.end_time * 1000).toISOString() : "",
    status: p.status ?? "unknown",
  }));
}

export async function extractShopeeOrderFees(
  clientId: string,
  orderSn: string,
): Promise<ShopeeOrderFeeBreakdown | null> {
  const res = await shopeeApiGet<{
    response?: {
      order_list?: Array<{
        commission_fee?: number;
        service_fee?: number;
        shipping_subsidy?: number;
        escrow_amount?: number;
      }>;
    };
  }>(clientId, "/api/v2/order/get_order_detail", {
    order_sn_list: orderSn,
    response_optional_fields: "commission_fee,service_fee,shipping_subsidy,escrow_amount",
  });

  const order = res?.response?.order_list?.[0];
  if (!order) return null;

  const commissionCents = Math.round(Number(order.commission_fee ?? 0) * 100);
  const serviceFeeCents = Math.round(Number(order.service_fee ?? 0) * 100);
  const shippingSubsidyCents = Math.round(Number(order.shipping_subsidy ?? 0) * 100);
  const totalFeeCents = commissionCents + serviceFeeCents;

  const { data: dbOrder } = await supabaseAdmin
    .from("orders")
    .select("id, value_cents")
    .eq("client_id", clientId)
    .eq("channel", "shopee")
    .eq("external_id", orderSn)
    .maybeSingle();

  if (dbOrder) {
    await snapshotOrderFees(clientId, dbOrder.id as string, "shopee", Number(dbOrder.value_cents ?? 0), {
      marketplace_fee_cents: commissionCents,
      shipping_fee_cents: shippingSubsidyCents,
      other_fee_cents: serviceFeeCents,
    });
  }

  return { commissionCents, serviceFeeCents, shippingSubsidyCents, totalFeeCents };
}

export async function triggerNegativeReviewRetention(
  clientId: string,
  review: { orderSn: string; rating: number; comment?: string; buyerId?: string },
): Promise<{ enrolled: boolean }> {
  if (review.rating > 2) return { enrolled: false };

  let customerId: string | null = null;
  if (review.buyerId) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("client_id", clientId)
      .eq("external_id", review.buyerId)
      .maybeSingle();
    customerId = customer?.id ?? null;
  }

  const enrollmentId = await enrollInSequence({
    clientId,
    trigger: "avaliacao_negativa",
    customerId,
    context: {
      channel: "shopee",
      order_sn: review.orderSn,
      rating: review.rating,
      comment: review.comment ?? "",
    },
  });

  if (enrollmentId) {
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "retention",
      severity: "warning",
      title: "Avaliação negativa Shopee",
      message: `Pedido ${review.orderSn} — nota ${review.rating}. Sequência de retenção iniciada.`,
      is_resolved: false,
    });
  }

  return { enrolled: enrollmentId != null };
}

export async function checkShopeeHealth(clientId: string): Promise<{
  penalties: ShopeePenaltyMetrics | null;
  score: ShopeeShopScore | null;
  slaAlerts: { alertsSent: number; ordersChecked: number };
}> {
  const [penalties, score, slaAlerts] = await Promise.all([
    fetchShopeePenaltyMetrics(clientId),
    fetchShopeeShopScore(clientId),
    checkShopeeSlaAlerts(clientId),
  ]);

  if (penalties && penalties.penaltyPoints > 0) {
    await supabaseAdmin.from("marketplace_penalty_records").insert({
      client_id: clientId,
      channel: "shopee",
      penalty_type: "performance",
      amount_cents: penalties.penaltyPoints * 100,
      description: `Pontos de penalidade Shopee: ${penalties.penaltyPoints}`,
    });
  }

  return { penalties, score, slaAlerts };
}

export async function syncShopeeAdvanced(clientId: string): Promise<{
  promotions: number;
  penaltyPoints: number;
}> {
  const [promotions, health] = await Promise.all([
    fetchShopeePromotions(clientId),
    checkShopeeHealth(clientId),
  ]);

  return {
    promotions: promotions.length,
    penaltyPoints: health.penalties?.penaltyPoints ?? 0,
  };
}
