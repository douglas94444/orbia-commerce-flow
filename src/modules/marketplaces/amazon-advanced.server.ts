import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { snapshotOrderFees } from "./channel-profitability.server";
import { getMarketplaceConnection } from "./_oauth.server";

const SP_API_HOST = "https://sellingpartnerapi-na.amazon.com";
const MARKETPLACE_ID = "A2Q3Y263D00KWC";

async function amazonFetch<T>(
  clientId: string,
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T | null> {
  const end = startTimer();
  const url = path.startsWith("http") ? path : `${SP_API_HOST}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "x-amz-access-token": token,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  await logIntegration({
    client_id: clientId,
    provider: "amazon",
    operation: `${init?.method ?? "GET"} ${path}`,
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
  });

  if (!res.ok) return null;
  return (await res.json()) as T;
}

export type AmazonFulfillmentType = "FBA" | "MFN" | "unknown";

export interface FbaInventoryRow {
  sku: string;
  asin: string;
  fulfillableQty: number;
  inboundQty: number;
  reservedQty: number;
}

export interface BuyBoxStatus {
  asin: string;
  isBuyBoxWinner: boolean;
  priceCents: number | null;
  sellerId: string | null;
}

export interface AmazonAccountHealth {
  orderDefectRate: number;
  lateShipmentRate: number;
  preFulfillmentCancelRate: number;
  healthStatus: "GOOD" | "AT_RISK" | "CRITICAL" | "UNKNOWN";
}

export interface AmazonOrderFees {
  referralFeeCents: number;
  fbaFeeCents: number;
  otherFeeCents: number;
  totalFeeCents: number;
}

export function classifyAmazonOrderFulfillment(
  order: Record<string, unknown>,
): AmazonFulfillmentType {
  const channel = String(order.FulfillmentChannel ?? order.fulfillment_channel ?? "").toUpperCase();
  if (channel === "AFN" || channel.includes("AMAZON")) return "FBA";
  if (channel === "MFN" || channel.includes("MERCHANT")) return "MFN";
  return "unknown";
}

export async function fetchFbaInventory(clientId: string): Promise<FbaInventoryRow[]> {
  const conn = await getMarketplaceConnection(clientId, "amazon");
  if (!conn) return [];

  const url = new URL(`${SP_API_HOST}/fba/inventory/v1/summaries`);
  url.searchParams.set("details", "true");
  url.searchParams.set("granularityType", "Marketplace");
  url.searchParams.set("granularityId", MARKETPLACE_ID);
  url.searchParams.set("marketplaceIds", MARKETPLACE_ID);

  const body = await amazonFetch<{
    payload?: {
      inventorySummaries?: Array<{
        asin?: string;
        sellerSku?: string;
        totalQuantity?: number;
        inventoryDetails?: {
          fulfillableQuantity?: number;
          inboundWorkingQuantity?: number;
          reservedQuantity?: { totalReservedQuantity?: number };
        };
      }>;
    };
  }>(clientId, url.toString(), conn.accessToken);

  return (body?.payload?.inventorySummaries ?? []).map((item) => ({
    sku: item.sellerSku ?? item.asin ?? "UNKNOWN",
    asin: item.asin ?? "",
    fulfillableQty: item.inventoryDetails?.fulfillableQuantity ?? item.totalQuantity ?? 0,
    inboundQty: item.inventoryDetails?.inboundWorkingQuantity ?? 0,
    reservedQty: item.inventoryDetails?.reservedQuantity?.totalReservedQuantity ?? 0,
  }));
}

export async function checkBuyBoxStatus(clientId: string, asin: string): Promise<BuyBoxStatus> {
  const conn = await getMarketplaceConnection(clientId, "amazon");
  if (!conn) {
    return { asin, isBuyBoxWinner: false, priceCents: null, sellerId: null };
  }

  const body = await amazonFetch<{
    payload?: Array<{
      ASIN?: string;
      Product?: {
        CompetitivePricing?: {
          CompetitivePrices?: Array<{
            belongsToRequester?: boolean;
            Price?: { ListingPrice?: { Amount?: number } };
          }>;
        };
      };
    }>;
  }>(
    clientId,
    `${SP_API_HOST}/products/pricing/v0/competitivePrice?MarketplaceId=${MARKETPLACE_ID}&ItemType=Asin&Asins=${asin}`,
    conn.accessToken,
  );

  const item = body?.payload?.[0];
  const prices = item?.Product?.CompetitivePricing?.CompetitivePrices ?? [];
  const winner = prices.find((p) => p.belongsToRequester);
  const amount = winner?.Price?.ListingPrice?.Amount;

  return {
    asin,
    isBuyBoxWinner: Boolean(winner),
    priceCents: amount != null ? Math.round(amount * 100) : null,
    sellerId: conn.externalAccount || null,
  };
}

export async function fetchAccountHealth(clientId: string): Promise<AmazonAccountHealth> {
  const conn = await getMarketplaceConnection(clientId, "amazon");
  if (!conn) {
    return {
      orderDefectRate: 0,
      lateShipmentRate: 0,
      preFulfillmentCancelRate: 0,
      healthStatus: "UNKNOWN",
    };
  }

  const body = await amazonFetch<{
    performanceMetrics?: Array<{
      orderDefectRate?: { rate?: number };
      lateShipmentRate?: { rate?: number };
      preFulfillmentCancelRate?: { rate?: number };
      accountHealthRating?: { status?: string };
    }>;
  }>(
    clientId,
    `${SP_API_HOST}/seller/v1/performanceMetrics?marketplaceId=${MARKETPLACE_ID}`,
    conn.accessToken,
  );

  const metrics = body?.performanceMetrics?.[0];
  const status = String(metrics?.accountHealthRating?.status ?? "UNKNOWN").toUpperCase();
  const healthStatus: AmazonAccountHealth["healthStatus"] =
    status === "GOOD" || status === "AT_RISK" || status === "CRITICAL" ? status : "UNKNOWN";

  return {
    orderDefectRate: metrics?.orderDefectRate?.rate ?? 0,
    lateShipmentRate: metrics?.lateShipmentRate?.rate ?? 0,
    preFulfillmentCancelRate: metrics?.preFulfillmentCancelRate?.rate ?? 0,
    healthStatus,
  };
}

export async function extractAmazonOrderFees(
  clientId: string,
  amazonOrderId: string,
): Promise<AmazonOrderFees | null> {
  const conn = await getMarketplaceConnection(clientId, "amazon");
  if (!conn) return null;

  const body = await amazonFetch<{
    payload?: {
      OrderItems?: Array<{
        ItemPrice?: { Amount?: number };
        PromotionDiscount?: { Amount?: number };
        ShippingPrice?: { Amount?: number };
      }>;
      AmazonOrderId?: string;
    };
  }>(
    clientId,
    `${SP_API_HOST}/orders/v0/orders/${amazonOrderId}/orderItems`,
    conn.accessToken,
  );

  const items = body?.payload?.OrderItems ?? [];
  const gmvCents = items.reduce(
    (sum, i) => sum + Math.round(Number(i.ItemPrice?.Amount ?? 0) * 100),
    0,
  );

  let feeBody: {
    payload?: {
      FeesEstimate?: {
        TotalFeesEstimate?: { Amount?: number };
        FeeDetailList?: Array<{ FeeType?: string; FeeAmount?: { Amount?: number } }>;
      };
    };
  } | null = null;

  try {
    feeBody = await amazonFetch(
      clientId,
      `${SP_API_HOST}/products/fees/v0/items/${amazonOrderId}/feesEstimate`,
      conn.accessToken,
    );
  } catch {
    feeBody = null;
  }

  let referralFeeCents = 0;
  let fbaFeeCents = 0;
  let otherFeeCents = 0;

  for (const fee of feeBody?.payload?.FeesEstimate?.FeeDetailList ?? []) {
    const cents = Math.round(Number(fee.FeeAmount?.Amount ?? 0) * 100);
    const type = String(fee.FeeType ?? "").toLowerCase();
    if (type.includes("referral")) referralFeeCents += cents;
    else if (type.includes("fba")) fbaFeeCents += cents;
    else otherFeeCents += cents;
  }

  if (!referralFeeCents && !fbaFeeCents) {
    const total = Math.round(
      Number(feeBody?.payload?.FeesEstimate?.TotalFeesEstimate?.Amount ?? gmvCents * 0.15) * 100,
    );
    referralFeeCents = Math.round(total * 0.6);
    fbaFeeCents = total - referralFeeCents;
  }

  const totalFeeCents = referralFeeCents + fbaFeeCents + otherFeeCents;

  const { data: dbOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("client_id", clientId)
    .eq("channel", "amazon")
    .eq("external_id", amazonOrderId)
    .maybeSingle();

  if (dbOrder) {
    await snapshotOrderFees(clientId, dbOrder.id as string, "amazon", gmvCents, {
      marketplace_fee_cents: referralFeeCents,
      shipping_fee_cents: fbaFeeCents,
      other_fee_cents: otherFeeCents,
    });
  }

  return { referralFeeCents, fbaFeeCents, otherFeeCents, totalFeeCents };
}

export async function syncAmazonAdsSpend(clientId: string): Promise<{ spendCents: number }> {
  const end = startTimer();
  const conn = await getMarketplaceConnection(clientId, "amazon");
  if (!conn) return { spendCents: 0 };

  let spendCents = 0;
  try {
    const body = await amazonFetch<{
      campaigns?: Array<{ metrics?: { cost?: number } }>;
    }>(
      clientId,
      `${SP_API_HOST}/advertising/v1/campaigns?marketplaceId=${MARKETPLACE_ID}`,
      conn.accessToken,
    );
    for (const c of body?.campaigns ?? []) {
      spendCents += Math.round(Number(c.metrics?.cost ?? 0) * 100);
    }
  } catch {
    /* Ads API scope may be missing */
  }

  if (spendCents > 0) {
    await supabaseAdmin.from("campaigns").upsert(
      {
        client_id: clientId,
        name: "Amazon Ads (auto)",
        platform: "amazon",
        status: "active",
        spend_cents: spendCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,platform,name" },
    );
  }

  await logIntegration({
    client_id: clientId,
    provider: "amazon",
    operation: "sync_ads_spend",
    status: "success",
    duration_ms: end(),
    metadata: { spendCents },
  });

  return { spendCents };
}

export async function checkAmazonHealth(clientId: string): Promise<{
  health: AmazonAccountHealth;
  fbaSkus: number;
}> {
  const [health, inventory] = await Promise.all([
    fetchAccountHealth(clientId),
    fetchFbaInventory(clientId),
  ]);

  if (health.healthStatus === "AT_RISK" || health.healthStatus === "CRITICAL") {
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "marketplace",
      severity: health.healthStatus === "CRITICAL" ? "critical" : "warning",
      title: "Saúde da conta Amazon",
      message: `Status ${health.healthStatus} — ODR ${(health.orderDefectRate * 100).toFixed(1)}%, atraso ${(health.lateShipmentRate * 100).toFixed(1)}%`,
      is_resolved: false,
    });

    await supabaseAdmin.from("marketplace_penalty_records").insert({
      client_id: clientId,
      channel: "amazon",
      penalty_type: "account_health",
      amount_cents: 0,
      description: `Account health: ${health.healthStatus}`,
    });
  }

  return { health, fbaSkus: inventory.length };
}

export async function syncAmazonAdvanced(clientId: string): Promise<{
  healthStatus: string;
  fbaSkus: number;
  adsSpendCents: number;
}> {
  const [healthResult, ads] = await Promise.all([
    checkAmazonHealth(clientId),
    syncAmazonAdsSpend(clientId),
  ]);

  return {
    healthStatus: healthResult.health.healthStatus,
    fbaSkus: healthResult.fbaSkus,
    adsSpendCents: ads.spendCents,
  };
}
