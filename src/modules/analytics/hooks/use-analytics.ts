import { useQuery } from "@tanstack/react-query";
import { getPortfolioAnalytics, getNfeCount30d, listOperationAlerts } from "../actions.functions";

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
