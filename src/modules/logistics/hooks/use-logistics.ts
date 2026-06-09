import { useQuery } from "@tanstack/react-query";
import { listOrders, listInventory, getLogisticsStats } from "../actions.functions";

export const ORDERS_KEY = ["orders"] as const;
export const INVENTORY_KEY = ["inventory"] as const;
export const LOGISTICS_STATS_KEY = ["logistics-stats"] as const;

export function useOrders() {
  return useQuery({ queryKey: ORDERS_KEY, queryFn: () => listOrders(), staleTime: 15_000 });
}

export function useInventory() {
  return useQuery({ queryKey: INVENTORY_KEY, queryFn: () => listInventory(), staleTime: 30_000 });
}

export function useLogisticsStats() {
  return useQuery({
    queryKey: LOGISTICS_STATS_KEY,
    queryFn: () => getLogisticsStats(),
    staleTime: 15_000,
  });
}
