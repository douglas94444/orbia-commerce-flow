import { useQuery } from "@tanstack/react-query";
import { getPortfolioAnalytics, getNfeCount30d, listOperationAlerts, getClientAiInsights } from "../actions.functions";

export const ANALYTICS_KEY = ["portfolio-analytics"] as const;
export const NFE_COUNT_KEY = ["nfe-count-30d"] as const;
export const ALERTS_KEY = ["operation-alerts"] as const;

export function usePortfolioAnalytics() {
  return useQuery({
    queryKey: ANALYTICS_KEY,
    queryFn: () => getPortfolioAnalytics(),
    staleTime: 60_000,
  });
}

export function useNfeCount30d() {
  return useQuery({
    queryKey: NFE_COUNT_KEY,
    queryFn: () => getNfeCount30d(),
    staleTime: 60_000,
  });
}

export function useOperationAlerts() {
  return useQuery({
    queryKey: ALERTS_KEY,
    queryFn: () => listOperationAlerts(),
    staleTime: 30_000,
  });
}

export const AI_INSIGHTS_KEY = (clientId?: string) =>
  ["ai-insights", clientId ?? "portfolio"] as const;

export function useAiInsights(clientId?: string) {
  return useQuery({
    queryKey: AI_INSIGHTS_KEY(clientId),
    queryFn: () =>
      (getClientAiInsights as unknown as (opts: { data: Record<string, unknown> }) => Promise<unknown>)(
        { data: clientId ? { clientId } : {} },
      ) as Promise<import("../actions.functions").AiInsight[]>,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
