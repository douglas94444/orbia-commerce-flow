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
  listReturnsFn,
  approveReturnFn,
  markReturnReceivedFn,
  inspectReturnFn,
  getStockRuptureFn,
  getDeliveryIncidentsFn,
  generateWaveLabelsFn,
  getDispatchManifestFn,
  listCarrierConfigsFn,
  upsertCarrierConfigFn,
  getReturnReasonsReportFn,
  createReturnRequestFn,
  getLogisticsAnalyticsFn,
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
    mutationFn: (input: { sessionId: string; photoUrls?: string[] }) =>
      completePackingFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Packing concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReturns() {
  return useQuery({ queryKey: ["returns"], queryFn: () => listReturnsFn() });
}

export function useApproveReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (returnRequestId: string) => approveReturnFn({ data: { returnRequestId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      toast.success("Devolução aprovada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkReturnReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (returnRequestId: string) => markReturnReceivedFn({ data: { returnRequestId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      toast.success("Devolução recebida");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInspectReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      returnRequestId: string;
      destination: "reintegrate" | "quarantine" | "discard";
      notes?: string;
      photoUrls?: string[];
    }) => inspectReturnFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      toast.success("Inspeção registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStockRupture() {
  return useQuery({ queryKey: ["stock-rupture"], queryFn: () => getStockRuptureFn() });
}

export function useDeliveryIncidents() {
  return useQuery({ queryKey: ["delivery-incidents"], queryFn: () => getDeliveryIncidentsFn() });
}

export function useGenerateWaveLabels() {
  return useMutation({
    mutationFn: (waveId: string) => generateWaveLabelsFn({ data: { waveId } }),
    onSuccess: () => toast.success("Etiquetas geradas"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDispatchManifest() {
  return useMutation({
    mutationFn: (waveId: string) => getDispatchManifestFn({ data: { waveId } }),
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

export function useCarrierConfigs() {
  return useQuery({
    queryKey: ["carrier-configs"],
    queryFn: () => listCarrierConfigsFn(),
  });
}

export function useUpsertCarrierConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      provider: string;
      isActive: boolean;
      priority: number;
      autoSelect: boolean;
      credentialsRef?: string;
    }) => upsertCarrierConfigFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carrier-configs"] });
      toast.success("Transportadora salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLogisticsAnalytics() {
  return useQuery({
    queryKey: ["logistics-analytics"],
    queryFn: () => getLogisticsAnalyticsFn(),
    staleTime: 60_000,
  });
}

export function useReturnReasonsReport() {
  return useQuery({
    queryKey: ["return-reasons-report"],
    queryFn: () => getReturnReasonsReportFn(),
  });
}

export function useCreateReturnRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      orderId: string;
      reason: string;
      items: Array<{ sku: string; qty: number }>;
    }) => createReturnRequestFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["return-reasons-report"] });
      toast.success("Solicitação de devolução enviada");
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
