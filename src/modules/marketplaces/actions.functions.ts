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
} from "./mercado-livre-advanced.server";
import {
  fetchShopeePenaltyMetrics,
  fetchShopeeShopScore,
  fetchShopeePromotions,
} from "./shopee-advanced.server";
import { fetchFbaInventory, fetchAccountHealth } from "./amazon-advanced.server";
import { getSalesByOrigin, getAffiliateCommissions } from "./tiktok-advanced.server";
import {
  fetchPaymentGatewayMetadata,
  fetchTrafficSourceReport,
  listShopifyGiftCards,
} from "./storefront-advanced.server";
import { syncInstagramCatalogToMeta } from "./instagram-commerce.server";

async function resolveClientId(
  supabase: { rpc: (fn: string) => Promise<{ data: string | null; error: unknown }>; from: (t: string) => unknown },
): Promise<string> {
  const { data: clientId } = await supabase.rpc("current_client_id");
  if (clientId) return clientId;
  const q = supabase.from("clients") as {
    select: (c: string) => { limit: (n: number) => Promise<{ data: Array<{ id: string }> | null }> };
  };
  const { data: clients } = await q.select("id").limit(1);
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