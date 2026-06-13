import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMarketplaceProfitability,
  getMarketplaceProductProfitability,
  getMlQuestionsDashboard,
  suggestMlAnswerFn,
  getMlReputationDashboard,
  getShopeeMetricsDashboard,
  getAmazonMetricsDashboard,
  getTiktokMetricsDashboard,
  getStorefrontMetricsDashboard,
  getInstagramCommerceDashboard,
  runMarketplaceAdvancedSyncFn,
  getChannelAnalytics,
  getIntegrationHealthDashboard,
  exportChannelsCsv,
} from "../actions.functions";

export const MARKETPLACE_PROFITABILITY_KEY = ["marketplace-profitability"] as const;
export const CHANNEL_ANALYTICS_KEY = ["channel-analytics"] as const;
export const INTEGRATION_HEALTH_KEY = ["integration-health"] as const;
export const ML_QUESTIONS_KEY = ["ml-questions"] as const;
export const ML_REPUTATION_KEY = ["ml-reputation"] as const;
export const SHOPEE_METRICS_KEY = ["shopee-metrics"] as const;
export const AMAZON_METRICS_KEY = ["amazon-metrics"] as const;
export const TIKTOK_METRICS_KEY = ["tiktok-metrics"] as const;
export const STOREFRONT_METRICS_KEY = ["storefront-metrics"] as const;
export const INSTAGRAM_COMMERCE_KEY = ["instagram-commerce"] as const;

export function useMarketplaceProfitability() {
  return useQuery({
    queryKey: MARKETPLACE_PROFITABILITY_KEY,
    queryFn: () => getMarketplaceProfitability(),
    staleTime: 60_000,
  });
}

export function useChannelAnalytics(days = 30) {
  return useQuery({
    queryKey: [...CHANNEL_ANALYTICS_KEY, days],
    queryFn: () => getChannelAnalytics({ data: { days } }),
    staleTime: 60_000,
  });
}

export function useIntegrationHealth() {
  return useQuery({
    queryKey: INTEGRATION_HEALTH_KEY,
    queryFn: () => getIntegrationHealthDashboard(),
    staleTime: 30_000,
  });
}

export function useMarketplaceProductProfitability(channel: string, days = 30) {
  return useQuery({
    queryKey: [...MARKETPLACE_PROFITABILITY_KEY, channel, days],
    queryFn: () => getMarketplaceProductProfitability({ data: { channel, days } }),
    enabled: Boolean(channel),
    staleTime: 60_000,
  });
}

export function useMlQuestions() {
  return useQuery({
    queryKey: ML_QUESTIONS_KEY,
    queryFn: () => getMlQuestionsDashboard(),
    staleTime: 30_000,
  });
}

export function useSuggestMlAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { questionText: string; productTitle: string; productDescription?: string }) =>
      suggestMlAnswerFn({ data: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ML_QUESTIONS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useMlReputation() {
  return useQuery({
    queryKey: ML_REPUTATION_KEY,
    queryFn: () => getMlReputationDashboard(),
    staleTime: 60_000,
  });
}

export function useShopeeMetrics() {
  return useQuery({
    queryKey: SHOPEE_METRICS_KEY,
    queryFn: () => getShopeeMetricsDashboard(),
    staleTime: 60_000,
  });
}

export function useAmazonMetrics() {
  return useQuery({
    queryKey: AMAZON_METRICS_KEY,
    queryFn: () => getAmazonMetricsDashboard(),
    staleTime: 60_000,
  });
}

export function useTiktokMetrics() {
  return useQuery({
    queryKey: TIKTOK_METRICS_KEY,
    queryFn: () => getTiktokMetricsDashboard(),
    staleTime: 60_000,
  });
}

export function useStorefrontMetrics(channel: "nuvemshop" | "shopify") {
  return useQuery({
    queryKey: [...STOREFRONT_METRICS_KEY, channel],
    queryFn: () => getStorefrontMetricsDashboard({ data: { channel } }),
    staleTime: 60_000,
  });
}

export function useInstagramCommerce() {
  return useQuery({
    queryKey: INSTAGRAM_COMMERCE_KEY,
    queryFn: () => getInstagramCommerceDashboard(),
    staleTime: 60_000,
  });
}

export function useRunMarketplaceAdvancedSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => runMarketplaceAdvancedSyncFn(),
    onSuccess: () => {
      toast.success("Sincronização avançada de marketplaces concluída");
      void qc.invalidateQueries({ queryKey: MARKETPLACE_PROFITABILITY_KEY });
      void qc.invalidateQueries({ queryKey: ML_REPUTATION_KEY });
      void qc.invalidateQueries({ queryKey: SHOPEE_METRICS_KEY });
      void qc.invalidateQueries({ queryKey: AMAZON_METRICS_KEY });
      void qc.invalidateQueries({ queryKey: TIKTOK_METRICS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
