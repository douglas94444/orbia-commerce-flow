import { shopifyFetch } from "@/integrations/shopify/client";
import { nuvemshopFetch } from "@/integrations/nuvemshop/client";
import { pullShopifyProducts } from "@/integrations/shopify/catalog";
import { pullNuvemshopProducts } from "@/integrations/nuvemshop/catalog";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { getMarketplaceConnection } from "./_oauth.server";

export type StorefrontChannel = "nuvemshop" | "shopify";

export interface CatalogSyncStubResult {
  channel: StorefrontChannel;
  pulled: number;
  pushed: number;
  status: "stub" | "partial" | "complete";
}

export interface PaymentGatewayMetadata {
  gateway: string;
  provider: string;
  feeRatePercent: number | null;
  settlementDays: number | null;
  raw: Record<string, unknown>;
}

export interface TrafficSourceRow {
  source: string;
  medium: string;
  sessions: number;
  orders: number;
  revenueCents: number;
}

export interface ShopifyGiftCard {
  id: string;
  code: string;
  balanceCents: number;
  initialValueCents: number;
  disabled: boolean;
}

export async function syncStorefrontCatalogBidirectional(
  clientId: string,
  channel: StorefrontChannel,
): Promise<CatalogSyncStubResult> {
  const conn = await getMarketplaceConnection(clientId, channel);
  if (!conn) {
    return { channel, pulled: 0, pushed: 0, status: "stub" };
  }

  const end = startTimer();
  let pulled = 0;

  if (channel === "shopify") {
    const shop = String(conn.metadata.shop ?? conn.externalAccount);
    const rows = await pullShopifyProducts(shop, conn.accessToken);
    pulled = rows.length;
  } else {
    const rows = await pullNuvemshopProducts(conn.externalAccount, conn.accessToken);
    pulled = rows.length;
  }

  const { data: listings } = await supabaseAdmin
    .from("channel_listings")
    .select("id")
    .eq("client_id", clientId)
    .eq("channel", channel);

  await logIntegration({
    client_id: clientId,
    provider: channel,
    operation: "bidirectional_catalog_sync_stub",
    status: "success",
    duration_ms: end(),
    metadata: { pulled, localListings: listings?.length ?? 0 },
  });

  return {
    channel,
    pulled,
    pushed: 0,
    status: pulled > 0 ? "partial" : "stub",
  };
}

export async function fetchPaymentGatewayMetadata(
  clientId: string,
  channel: StorefrontChannel,
): Promise<PaymentGatewayMetadata[]> {
  const conn = await getMarketplaceConnection(clientId, channel);
  if (!conn) return [];

  const gateways: PaymentGatewayMetadata[] = [];

  if (channel === "shopify") {
    const shop = String(conn.metadata.shop ?? conn.externalAccount);
    try {
      const res = await shopifyFetch<{ payment_gateways?: Array<Record<string, unknown>> }>(
        shop,
        conn.accessToken,
        "/payment_gateways.json",
      );
      for (const gw of res.payment_gateways ?? []) {
        gateways.push({
          gateway: String(gw.name ?? gw.provider ?? "unknown"),
          provider: "shopify",
          feeRatePercent: null,
          settlementDays: null,
          raw: gw,
        });
      }
    } catch {
      gateways.push({
        gateway: "shopify_payments",
        provider: "shopify",
        feeRatePercent: 3.99,
        settlementDays: 7,
        raw: {},
      });
    }
  } else {
    try {
      const res = await nuvemshopFetch<Array<Record<string, unknown>>>(
        conn.externalAccount,
        conn.accessToken,
        "/payment_providers",
      );
      for (const gw of res ?? []) {
        gateways.push({
          gateway: String(gw.name ?? gw.code ?? "unknown"),
          provider: "nuvemshop",
          feeRatePercent: gw.fee != null ? Number(gw.fee) : null,
          settlementDays: gw.settlement_days != null ? Number(gw.settlement_days) : null,
          raw: gw,
        });
      }
    } catch {
      gateways.push({
        gateway: "mercadopago",
        provider: "nuvemshop",
        feeRatePercent: 4.99,
        settlementDays: 14,
        raw: {},
      });
    }
  }

  return gateways;
}

export async function fetchTrafficSourceReport(
  clientId: string,
  channel: StorefrontChannel,
  days = 30,
): Promise<TrafficSourceRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("value_cents, metadata")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .neq("status", "cancelado")
    .gte("created_at", since.toISOString());

  const bySource = new Map<string, TrafficSourceRow>();

  for (const o of orders ?? []) {
    const meta = (o.metadata ?? {}) as Record<string, unknown>;
    const utm = (meta.utm ?? meta.traffic_source ?? {}) as Record<string, unknown>;
    const source = String(utm.source ?? meta.referring_site ?? "direct");
    const medium = String(utm.medium ?? "none");
    const key = `${source}|${medium}`;
    const cur = bySource.get(key) ?? {
      source,
      medium,
      sessions: 0,
      orders: 0,
      revenueCents: 0,
    };
    cur.orders += 1;
    cur.revenueCents += Number(o.value_cents ?? 0);
    bySource.set(key, cur);
  }

  return [...bySource.values()].sort((a, b) => b.revenueCents - a.revenueCents);
}

export async function shopifyCreateFulfillment(
  clientId: string,
  orderExternalId: string,
  trackingNumber: string,
  trackingCompany?: string,
): Promise<{ fulfillmentId: string | null }> {
  const conn = await getMarketplaceConnection(clientId, "shopify");
  if (!conn) return { fulfillmentId: null };

  const shop = String(conn.metadata.shop ?? conn.externalAccount);
  const res = await shopifyFetch<{ fulfillment?: { id: number } }>(
    shop,
    conn.accessToken,
    `/orders/${orderExternalId}/fulfillments.json`,
    {
      method: "POST",
      body: JSON.stringify({
        fulfillment: {
          tracking_number: trackingNumber,
          tracking_company: trackingCompany ?? "Correios",
          notify_customer: true,
        },
      }),
    },
  );

  return { fulfillmentId: res.fulfillment?.id ? String(res.fulfillment.id) : null };
}

export async function shopifyProcessRefund(
  clientId: string,
  orderExternalId: string,
  amountCents: number,
  reason?: string,
): Promise<{ refundId: string | null }> {
  const conn = await getMarketplaceConnection(clientId, "shopify");
  if (!conn) return { refundId: null };

  const shop = String(conn.metadata.shop ?? conn.externalAccount);
  const res = await shopifyFetch<{ refund?: { id: number } }>(
    shop,
    conn.accessToken,
    `/orders/${orderExternalId}/refunds.json`,
    {
      method: "POST",
      body: JSON.stringify({
        refund: {
          note: reason ?? "Refund via Orbia",
          transactions: [
            {
              parent_id: orderExternalId,
              amount: (amountCents / 100).toFixed(2),
              kind: "refund",
            },
          ],
        },
      }),
    },
  );

  return { refundId: res.refund?.id ? String(res.refund.id) : null };
}

export async function listShopifyGiftCards(clientId: string): Promise<ShopifyGiftCard[]> {
  const conn = await getMarketplaceConnection(clientId, "shopify");
  if (!conn) return [];

  const shop = String(conn.metadata.shop ?? conn.externalAccount);
  const res = await shopifyFetch<{
    gift_cards?: Array<{
      id: number;
      code?: string;
      balance?: string;
      initial_value?: string;
      disabled_at?: string | null;
    }>;
  }>(shop, conn.accessToken, "/gift_cards.json?status=enabled");

  return (res.gift_cards ?? []).map((gc) => ({
    id: String(gc.id),
    code: gc.code ?? "",
    balanceCents: Math.round(Number(gc.balance ?? 0) * 100),
    initialValueCents: Math.round(Number(gc.initial_value ?? 0) * 100),
    disabled: Boolean(gc.disabled_at),
  }));
}

export async function syncStorefrontAdvanced(clientId: string): Promise<{
  nuvemshop: CatalogSyncStubResult;
  shopify: CatalogSyncStubResult;
}> {
  const [nuvemshop, shopify] = await Promise.all([
    syncStorefrontCatalogBidirectional(clientId, "nuvemshop"),
    syncStorefrontCatalogBidirectional(clientId, "shopify"),
  ]);
  return { nuvemshop, shopify };
}
