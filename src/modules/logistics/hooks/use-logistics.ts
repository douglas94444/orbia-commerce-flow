import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listOrders, listInventory, getLogisticsStats, dispatchOrder, getUnifiedOrderQueueFn } from "../actions.functions";

export const ORDERS_KEY = ["orders"] as const;
export const INVENTORY_KEY = ["inventory"] as const;
export const LOGISTICS_STATS_KEY = ["logistics-stats"] as const;
export const UNIFIED_QUEUE_KEY = ["unified-order-queue"] as const;

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

export function useDispatchOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => dispatchOrder({ data: { orderId } }),
    onSuccess: (result) => {
      toast.success(`Etiqueta gerada — rastreio ${result.trackingCode}`);
      void qc.invalidateQueries({ queryKey: ORDERS_KEY });
      void qc.invalidateQueries({ queryKey: INVENTORY_KEY });
      void qc.invalidateQueries({ queryKey: UNIFIED_QUEUE_KEY });
      void qc.invalidateQueries({ queryKey: ["dispatch-queue"] });
      if (result.labelUrl) {
        window.open(result.labelUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnifiedOrderQueue(filters?: {
  channel?: string;
  status?: string;
  fulfillmentType?: string;
}) {
  return useQuery({
    queryKey: [...UNIFIED_QUEUE_KEY, filters],
    queryFn: () => getUnifiedOrderQueueFn({ data: filters }),
    staleTime: 15_000,
  });
}
