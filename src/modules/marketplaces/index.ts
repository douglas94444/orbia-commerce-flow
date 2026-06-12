export {
  getChannelProfitability,
  getProductProfitabilityByChannel,
  snapshotOrderFees,
  type ChannelProfitabilityRow,
  type ProductProfitabilityRow,
} from "./channel-profitability.server";

export { getMarketplaceConnection, listActiveMarketplaceClients } from "./_oauth.server";

export {
  syncMlListing,
  fetchMlQuestions,
  suggestMlAnswer,
  fetchMlReputation,
  splitMlFullStock,
  checkMlComplaints,
  syncMercadoAdsSpend,
  syncMercadoLivreAdvanced,
  snapshotMlOrderFees,
  type MlListingUpdate,
  type MlQuestion,
  type MlReputationMetrics,
  type MlComplaintAlert,
} from "./mercado-livre-advanced.server";

export {
  checkShopeeSlaAlerts,
  fetchShopeePenaltyMetrics,
  fetchShopeeShopScore,
  fetchShopeePromotions,
  extractShopeeOrderFees,
  triggerNegativeReviewRetention,
  checkShopeeHealth,
  syncShopeeAdvanced,
  type ShopeePenaltyMetrics,
  type ShopeeShopScore,
  type ShopeePromotion,
  type ShopeeOrderFeeBreakdown,
} from "./shopee-advanced.server";

export {
  classifyAmazonOrderFulfillment,
  fetchFbaInventory,
  checkBuyBoxStatus,
  fetchAccountHealth,
  extractAmazonOrderFees,
  syncAmazonAdsSpend,
  checkAmazonHealth,
  syncAmazonAdvanced,
  type AmazonFulfillmentType,
  type FbaInventoryRow,
  type BuyBoxStatus,
  type AmazonAccountHealth,
  type AmazonOrderFees,
} from "./amazon-advanced.server";

export {
  enqueueLiveOrderBurst,
  getSalesByOrigin,
  getAffiliateCommissions,
  checkTiktokSlaAlerts,
  extractTiktokOrderFees,
  syncTiktokAdvanced,
  type TiktokSalesByOrigin,
  type TiktokAffiliateCommission,
  type TiktokOrderFees,
} from "./tiktok-advanced.server";

export {
  syncStorefrontCatalogBidirectional,
  fetchPaymentGatewayMetadata,
  fetchTrafficSourceReport,
  shopifyCreateFulfillment,
  shopifyProcessRefund,
  listShopifyGiftCards,
  syncStorefrontAdvanced,
  type StorefrontChannel,
  type CatalogSyncStubResult,
  type PaymentGatewayMetadata,
  type TrafficSourceRow,
  type ShopifyGiftCard,
} from "./storefront-advanced.server";

export {
  syncInstagramCatalogToMeta,
  hardenInstagramOrderWebhook,
  attributeOrderFromPostMetadata,
  linkMetaAdsAttribution,
  syncInstagramCommerceAdvanced,
  type InstagramCatalogSyncResult,
  type PostAttribution,
  type MetaAdsAttributionLink,
} from "./instagram-commerce.server";

import { listActiveMarketplaceClients } from "./_oauth.server";
import { syncMercadoLivreAdvanced } from "./mercado-livre-advanced.server";
import { syncShopeeAdvanced } from "./shopee-advanced.server";
import { syncAmazonAdvanced } from "./amazon-advanced.server";
import { syncTiktokAdvanced } from "./tiktok-advanced.server";
import { syncStorefrontAdvanced } from "./storefront-advanced.server";
import { syncInstagramCommerceAdvanced } from "./instagram-commerce.server";
import { checkShopeeHealth } from "./shopee-advanced.server";
import { checkAmazonHealth } from "./amazon-advanced.server";

export async function runMarketplaceAdvancedSync(): Promise<Record<string, unknown>> {
  const providers = [
    "mercado_livre",
    "shopee",
    "amazon",
    "tiktok",
    "nuvemshop",
    "shopify",
    "instagram",
  ] as const;

  const summary: Record<string, unknown> = { clients: 0, channels: {} };

  for (const provider of providers) {
    const clientIds = await listActiveMarketplaceClients(provider);
    const channelResults: unknown[] = [];

    for (const clientId of clientIds) {
      summary.clients = Number(summary.clients) + 1;
      try {
        switch (provider) {
          case "mercado_livre":
            channelResults.push(await syncMercadoLivreAdvanced(clientId));
            break;
          case "shopee":
            channelResults.push(await syncShopeeAdvanced(clientId));
            break;
          case "amazon":
            channelResults.push(await syncAmazonAdvanced(clientId));
            break;
          case "tiktok":
            channelResults.push(await syncTiktokAdvanced(clientId));
            break;
          case "nuvemshop":
          case "shopify":
            channelResults.push(await syncStorefrontAdvanced(clientId));
            break;
          case "instagram":
            channelResults.push(await syncInstagramCommerceAdvanced(clientId));
            break;
        }
      } catch (err) {
        channelResults.push({ error: (err as Error).message, clientId });
      }
    }

    summary.channels = {
      ...(summary.channels as Record<string, unknown>),
      [provider]: { clients: clientIds.length, results: channelResults },
    };
  }

  return summary;
}

export async function runMarketplaceHealthChecks(): Promise<{
  shopee: number;
  amazon: number;
}> {
  let shopeeChecked = 0;
  let amazonChecked = 0;

  for (const clientId of await listActiveMarketplaceClients("shopee")) {
    await checkShopeeHealth(clientId);
    shopeeChecked += 1;
  }

  for (const clientId of await listActiveMarketplaceClients("amazon")) {
    await checkAmazonHealth(clientId);
    amazonChecked += 1;
  }

  return { shopee: shopeeChecked, amazon: amazonChecked };
}
