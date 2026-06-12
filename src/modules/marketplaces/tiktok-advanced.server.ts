import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { sendWhatsAppToClient } from "@/modules/logistics/notifications/whatsapp-alerts.server";
import { snapshotOrderFees } from "./channel-profitability.server";
import { getMarketplaceConnection } from "./_oauth.server";

const TTS_API = "https://open-api.tiktokglobalshop.com";

async function tiktokFetch<T>(
  clientId: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const conn = await getMarketplaceConnection(clientId, "tiktok");
  if (!conn) return null;

  const end = startTimer();
  const res = await fetch(`${TTS_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.accessToken}`,
      "Content-Type": "application/json",
      "x-tts-access-token": conn.accessToken,
    },
    body: JSON.stringify({ shop_id: conn.externalAccount, ...body }),
  });

  await logIntegration({
    client_id: clientId,
    provider: "tiktok",
    operation: path,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
  });

  if (!res.ok) return null;
  return (await res.json()) as T;
}

export interface TiktokSalesByOrigin {
  live: { orders: number; gmvCents: number };
  video: { orders: number; gmvCents: number };
  shop: { orders: number; gmvCents: number };
}

export interface TiktokAffiliateCommission {
  affiliateId: string;
  affiliateName: string;
  commissionCents: number;
  orderCount: number;
}

export interface TiktokOrderFees {
  platformFeeCents: number;
  affiliateFeeCents: number;
  shippingFeeCents: number;
  totalFeeCents: number;
}

export async function enqueueLiveOrderBurst(
  clientId: string,
  orders: Array<{ orderId: string; valueCents: number; origin?: string }>,
): Promise<{ enqueued: number }> {
  let enqueued = 0;

  for (const order of orders) {
    await emitDomainEvent("tiktok.live_order_burst", {
      client_id: clientId,
      order_id: order.orderId,
      value_cents: order.valueCents,
      origin: order.origin ?? "live",
      burst_at: new Date().toISOString(),
    });
    enqueued += 1;
  }

  if (enqueued >= 5) {
    await sendWhatsAppToClient(
      clientId,
      `🔴 TikTok Live: ${enqueued} pedidos recebidos em burst. Verifique estoque e separação.`,
    );
  }

  return { enqueued };
}

export async function getSalesByOrigin(
  clientId: string,
  days = 7,
): Promise<TiktokSalesByOrigin> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("value_cents, metadata")
    .eq("client_id", clientId)
    .eq("channel", "tiktok")
    .neq("status", "cancelado")
    .gte("created_at", since.toISOString());

  const result: TiktokSalesByOrigin = {
    live: { orders: 0, gmvCents: 0 },
    video: { orders: 0, gmvCents: 0 },
    shop: { orders: 0, gmvCents: 0 },
  };

  for (const o of orders ?? []) {
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    const origin = String(meta.tiktok_origin ?? meta.source ?? "shop").toLowerCase();
    const gmv = Number(o.value_cents ?? 0);
    const bucket =
      origin.includes("live") ? "live" : origin.includes("video") ? "video" : "shop";
    result[bucket].orders += 1;
    result[bucket].gmvCents += gmv;
  }

  const apiRes = await tiktokFetch<{
    data?: {
      live_gmv?: number;
      video_gmv?: number;
      shop_gmv?: number;
    };
  }>(clientId, "/analytics/202309/shop/performance", {
    start_date: since.toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
  });

  if (apiRes?.data) {
    if (apiRes.data.live_gmv) result.live.gmvCents = Math.round(apiRes.data.live_gmv * 100);
    if (apiRes.data.video_gmv) result.video.gmvCents = Math.round(apiRes.data.video_gmv * 100);
    if (apiRes.data.shop_gmv) result.shop.gmvCents = Math.round(apiRes.data.shop_gmv * 100);
  }

  return result;
}

export async function getAffiliateCommissions(
  clientId: string,
  days = 30,
): Promise<TiktokAffiliateCommission[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const res = await tiktokFetch<{
    data?: {
      affiliates?: Array<{
        affiliate_id?: string;
        affiliate_name?: string;
        commission?: number;
        order_count?: number;
      }>;
    };
  }>(clientId, "/affiliate/202309/commissions", {
    start_time: Math.floor(since.getTime() / 1000),
    end_time: Math.floor(Date.now() / 1000),
  });

  return (res?.data?.affiliates ?? []).map((a) => ({
    affiliateId: a.affiliate_id ?? "",
    affiliateName: a.affiliate_name ?? "Afiliado",
    commissionCents: Math.round(Number(a.commission ?? 0) * 100),
    orderCount: a.order_count ?? 0,
  }));
}

export async function checkTiktokSlaAlerts(clientId?: string): Promise<{
  alertsSent: number;
}> {
  let alertsSent = 0;

  let query = supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, sla_deadline_at, metadata")
    .eq("channel", "tiktok")
    .in("status", ["separacao", "em_picking", "em_packing"])
    .not("sla_deadline_at", "is", null);

  if (clientId) query = query.eq("client_id", clientId);

  const { data: orders } = await query.limit(50);
  const now = Date.now();

  for (const order of orders ?? []) {
    const deadline = new Date(order.sla_deadline_at as string).getTime();
    const hoursLeft = (deadline - now) / 3_600_000;
    if (hoursLeft > 4 || hoursLeft <= 0) continue;

    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    if (meta.tiktok_sla_alert_sent) continue;

    const cid = order.client_id as string;
    await sendWhatsAppToClient(
      cid,
      `⚠️ TikTok Shop SLA: pedido ${order.external_id} vence em ${Math.round(hoursLeft)}h.`,
    );

    await supabaseAdmin
      .from("orders")
      .update({
        metadata: { ...meta, tiktok_sla_alert_sent: true },
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    alertsSent += 1;
  }

  return { alertsSent };
}

export async function extractTiktokOrderFees(
  clientId: string,
  orderId: string,
): Promise<TiktokOrderFees | null> {
  const res = await tiktokFetch<{
    data?: {
      orders?: Array<{
        payment?: {
          platform_discount?: number;
          shipping_fee?: number;
          affiliate_commission?: number;
          total_fee?: number;
        };
        payment_total?: number;
      }>;
    };
  }>(clientId, "/order/202309/orders", { ids: [orderId] });

  const order = res?.data?.orders?.[0];
  if (!order) return null;

  const payment = order.payment ?? {};
  const platformFeeCents = Math.round(Number(payment.total_fee ?? 0) * 100);
  const affiliateFeeCents = Math.round(Number(payment.affiliate_commission ?? 0) * 100);
  const shippingFeeCents = Math.round(Number(payment.shipping_fee ?? 0) * 100);
  const totalFeeCents = platformFeeCents + affiliateFeeCents;

  const { data: dbOrder } = await supabaseAdmin
    .from("orders")
    .select("id, value_cents")
    .eq("client_id", clientId)
    .eq("channel", "tiktok")
    .eq("external_id", orderId)
    .maybeSingle();

  if (dbOrder) {
    await snapshotOrderFees(clientId, dbOrder.id as string, "tiktok", Number(dbOrder.value_cents ?? 0), {
      marketplace_fee_cents: platformFeeCents,
      other_fee_cents: affiliateFeeCents,
      shipping_fee_cents: shippingFeeCents,
    });
  }

  return { platformFeeCents, affiliateFeeCents, shippingFeeCents, totalFeeCents };
}

export async function syncTiktokAdvanced(clientId: string): Promise<{
  salesByOrigin: TiktokSalesByOrigin;
  affiliateCount: number;
  slaAlerts: number;
}> {
  const [salesByOrigin, affiliates, sla] = await Promise.all([
    getSalesByOrigin(clientId),
    getAffiliateCommissions(clientId),
    checkTiktokSlaAlerts(clientId),
  ]);

  return {
    salesByOrigin,
    affiliateCount: affiliates.length,
    slaAlerts: sla.alertsSent,
  };
}
