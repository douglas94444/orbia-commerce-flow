import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getChannelProfitability,
  getProductProfitabilityByChannel,
  type ChannelProfitabilityRow,
  type ProductProfitabilityRow,
} from "./channel-profitability.server";
import {
  fetchMlQuestions,
  suggestMlAnswer,
  fetchMlReputation,
  checkMlComplaints,
} from "./mercado-livre-advanced.server";
import {
  fetchShopeePenaltyMetrics,
  fetchShopeeShopScore,
  fetchShopeePromotions,
} from "./shopee-advanced.server";
import { fetchFbaInventory, fetchAccountHealth, checkBuyBoxStatus } from "./amazon-advanced.server";
import { getSalesByOrigin, getAffiliateCommissions } from "./tiktok-advanced.server";
import {
  fetchPaymentGatewayMetadata,
  fetchTrafficSourceReport,
  listShopifyGiftCards,
} from "./storefront-advanced.server";
import { syncInstagramCatalogToMeta } from "./instagram-commerce.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function resolveClientId(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
): Promise<string> {
  const { data: clientId } = await supabase.rpc("current_client_id");
  if (clientId) return clientId;
  const { data: clients } = await supabase.from("clients").select("id").limit(1);
  if (!clients?.[0]?.id) throw new Error("Cliente não identificado");
  return clients[0].id;
}

export const getMarketplaceProfitability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChannelProfitabilityRow[]> => {
    const clientId = await resolveClientId(context.supabase);
    return getChannelProfitability(clientId);
  });

export const getMarketplaceProductProfitability = createServerFn({ method: "GET" })
  .inputValidator(z.object({ channel: z.string(), days: z.number().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ProductProfitabilityRow[]> => {
    const clientId = await resolveClientId(context.supabase);
    return getProductProfitabilityByChannel(clientId, data.channel, data.days ?? 30);
  });

export const getMlQuestionsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    return fetchMlQuestions(clientId);
  });

export const suggestMlAnswerFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      questionText: z.string(),
      productTitle: z.string(),
      productDescription: z.string().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const answer = await suggestMlAnswer(
      data.questionText,
      data.productTitle,
      data.productDescription,
    );
    return { answer };
  });

export const getMlReputationDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    return fetchMlReputation(clientId);
  });

export const getMlComplaintsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    return checkMlComplaints(clientId);
  });

export const getShopeeMetricsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const [penalties, score, promotions] = await Promise.all([
      fetchShopeePenaltyMetrics(clientId),
      fetchShopeeShopScore(clientId),
      fetchShopeePromotions(clientId),
    ]);
    return { penalties, score, promotions };
  });

export const getAmazonMetricsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const [health, inventory] = await Promise.all([
      fetchAccountHealth(clientId),
      fetchFbaInventory(clientId),
    ]);
    return { health, inventory };
  });

export const checkBuyBoxStatusFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ asin: z.string().min(5).max(20) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    return checkBuyBoxStatus(clientId, data.asin.trim().toUpperCase());
  });

export const getTiktokMetricsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const [salesByOrigin, affiliates] = await Promise.all([
      getSalesByOrigin(clientId),
      getAffiliateCommissions(clientId),
    ]);
    return { salesByOrigin, affiliates };
  });

export const getStorefrontMetricsDashboard = createServerFn({ method: "GET" })
  .inputValidator(z.object({ channel: z.enum(["nuvemshop", "shopify"]) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const [gateways, traffic, giftCards] = await Promise.all([
      fetchPaymentGatewayMetadata(clientId, data.channel),
      fetchTrafficSourceReport(clientId, data.channel),
      data.channel === "shopify" ? listShopifyGiftCards(clientId) : Promise.resolve([]),
    ]);
    return { gateways, traffic, giftCards };
  });

export const getInstagramCommerceDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    return syncInstagramCatalogToMeta(clientId);
  });

export const getInstagramMetaAttributionSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("external_id, value_cents, metadata")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(200);

    const attributed = (orders ?? []).filter((o) => {
      const meta = (o.metadata ?? {}) as Record<string, unknown>;
      return meta.meta_ads_attribution != null;
    });

    return {
      totalOrders: attributed.length,
      totalGmvCents: attributed.reduce((s, o) => s + Number(o.value_cents ?? 0), 0),
      orders: attributed.slice(0, 20).map((o) => {
        const meta = (o.metadata ?? {}) as Record<string, unknown>;
        const attr = (meta.meta_ads_attribution ?? {}) as Record<string, unknown>;
        return {
          orderId: String(o.external_id ?? ""),
          campaignId: attr.campaign_id ? String(attr.campaign_id) : null,
          adId: attr.ad_id ? String(attr.ad_id) : null,
          spendCents: Number(attr.spend_cents ?? 0),
          gmvCents: Number(o.value_cents ?? 0),
        };
      }),
    };
  });

export const runMarketplaceAdvancedSyncFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { runMarketplaceAdvancedSync } = await import("./index");
    return runMarketplaceAdvancedSync();
  });

export const getChannelAnalytics = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().optional() }).optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { getOrdersByChannel } = await import(
      "@/modules/logistics/analytics/orders-by-channel.server"
    );
    return getOrdersByChannel(clientId, data?.days ?? 30);
  });

export const getIntegrationHealthDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { getIntegrationHealthForClient } = await import(
      "@/modules/integrations/integration-health.server"
    );
    return getIntegrationHealthForClient(clientId);
  });

export const exportChannelsCsv = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().optional() }).optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const days = data?.days ?? 30;
    const { getOrdersByChannel } = await import(
      "@/modules/logistics/analytics/orders-by-channel.server"
    );
    const { getChannelProfitability } = await import("./channel-profitability.server");

    const [channels, profitability] = await Promise.all([
      getOrdersByChannel(clientId, days),
      getChannelProfitability(clientId, days),
    ]);

    const profitByChannel = new Map(profitability.map((p) => [p.channel, p]));
    const header = "canal,pedidos,gmv_cents,ticket_cents,cancel_rate_pct,sla_pct,gmv_delta_pct,margin_pct,fee_cents";
    const lines = channels.map((row) => {
      const profit = profitByChannel.get(row.channel);
      return [
        row.channel,
        row.orderCount,
        row.gmvCents,
        row.averageTicketCents,
        row.cancelRatePercent,
        row.slaCompliancePercent,
        row.gmvDeltaPercent,
        profit?.marginPercent ?? "",
        profit?.feeCents ?? "",
      ].join(",");
    });

    return { csv: [header, ...lines].join("\n"), filename: `canais-${days}d.csv` };
  });