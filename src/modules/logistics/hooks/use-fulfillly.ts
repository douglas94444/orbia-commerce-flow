import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listWarehouseLocationsFn,
  listWmsProductsFn,
  adjustStockFn,
  listStockMovementsFn,
  generatePickWaveFn,
  confirmPickLineFn,
  completePickTaskFn,
  startPackingFn,
  confirmPackingItemFn,
  completePackingFn,
  getSlaDashboardFn,
  getOpsTasksFn,
  createReceivingAppointmentFn,
  confirmReceivingLineFn,
} from "../fulfillly.actions.functions";

export function useWarehouseLocations() {
  return useQuery({
    queryKey: ["warehouse-locations"],
    queryFn: () => listWarehouseLocationsFn(),
  });
}

export function useWmsProducts() {
  return useQuery({
    queryKey: ["wms-products"],
    queryFn: () => listWmsProductsFn(),
  });
}

export function useStockMovements() {
  return useQuery({
    queryKey: ["stock-movements"],
    queryFn: () => listStockMovementsFn(),
  });
}

export function useSlaDashboard() {
  return useQuery({
    queryKey: ["sla-dashboard"],
    queryFn: () => getSlaDashboardFn(),
  });
}

export function useOpsTasks() {
  return useQuery({
    queryKey: ["ops-tasks"],
    queryFn: () => getOpsTasksFn(),
    refetchInterval: 30_000,
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sku: string; delta: number; reason: string }) =>
      adjustStockFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Estoque ajustado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useGeneratePickWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generatePickWaveFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Onda de picking gerada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConfirmPickLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskLineId: string; barcode: string }) =>
      confirmPickLineFn({ data: input }),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error ?? "Erro no pick");
      else toast.success("Item confirmado");
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompletePickTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => completePickTaskFn({ data: { taskId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      toast.success("Picking concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStartPacking() {
  return useMutation({
    mutationFn: (orderId: string) => startPackingFn({ data: { orderId } }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConfirmPackingItem() {
  return useMutation({
    mutationFn: (input: { orderId: string; sku: string; qty: number }) =>
      confirmPackingItemFn({ data: input }),
    onSuccess: () => toast.success("Item embalado"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompletePacking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => completePackingFn({ data: { sessionId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Packing concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useConfirmReceivingLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sessionId: string;
      sku: string;
      expectedQty: number;
      receivedQty: number;
      barcodeScanned?: string;
    }) => confirmReceivingLineFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      toast.success("Linha conferida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateReceivingAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      scheduledAt: string;
      expectedItems: Array<{ sku: string; qty: number }>;
    }) => createReceivingAppointmentFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      toast.success("Recebimento agendado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
