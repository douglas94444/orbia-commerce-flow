import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listWarehouseLocationsFn,
  listWmsProductsFn,
  adjustStockFn,
  listStockMovementsFn,
  generatePickWaveFn,
  listPickWavesFn,
  confirmPickLineFn,
  markPickLineNotFoundFn,
  completePickTaskFn,
  startPackingFn,
  confirmPackingItemFn,
  completePackingFn,
  getPackingOrderItemsFn,
  dispatchOpsOrderFn,
  getOperatorPerformanceFn,
  getSlaDashboardFn,
  listSlaOrdersFn,
  exportSlaReportCsvFn,
  getSlaMonthlyReportFn,
  upsertChannelSlaRuleFn,
  generatePackingLabelFn,
  listCarrierPickupsFn,
  scheduleCarrierPickupFn,
  getDeliveryHeatMapFn,
  listWarehousesFn,
  upsertWarehouseFn,
  getOpsTasksFn,
  createReceivingAppointmentFn,
  confirmReceivingLineFn,
  listReturnsFn,
  approveReturnFn,
  rejectReturnFn,
  markReturnReceivedFn,
  inspectReturnFn,
  uploadReturnInspectionPhotoFn,
  getReturnPolicyFn,
  upsertReturnPolicyFn,
  getReturnRateKpiFn,
  getStockRuptureFn,
  getDeliveryIncidentsFn,
  resolveDeliveryIncidentFn,
  listTrackingQueueFn,
  getOrderTrackingTimelineFn,
  generateWaveLabelsFn,
  getDispatchManifestFn,
  exportManifestCsvFn,
  listDispatchQueueFn,
  listCarrierConfigsFn,
  upsertCarrierConfigFn,
  getReturnReasonsReportFn,
  createReturnRequestFn,
  getLogisticsAnalyticsFn,
  getLogisticsAnalyticsDashboardFn,
  exportLogisticsAnalyticsCsvFn,
  listUnifiedOccurrencesFn,
  exportOccurrencesCsvFn,
  getOpsLiveDashboardFn,
  listInventoryCountsFn,
  getInventoryCountLinesFn,
  startInventoryCountFn,
  recordInventoryCountLineFn,
  completeInventoryCountFn,
  exportInventoryCountFn,
  upsertWmsProductFn,
  uploadProductPhotoFn,
  upsertWarehouseLocationFn,
  deactivateWarehouseLocationFn,
  listLocationStockFn,
  assignSkuToLocationFn,
  listStockAlertSkusFn,
  listProductVariationsFn,
  listExpiringLotsFn,
  listQuarantineItemsFn,
  releaseQuarantineItemFn,
  discardQuarantineItemFn,
  listStockTurnoverFn,
  listRecentStockSyncsFn,
  startReceivingSessionFn,
  completeReceivingSessionFn,
  listOpsReceivingAppointmentsFn,
  getReceivingSessionContextFn,
  listReceivingAppointmentsFn,
  listReceivingReportsFn,
  exportReceivingReportFn,
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

export function useStockMovements(sku?: string, offset = 0) {
  return useQuery({
    queryKey: ["stock-movements", sku, offset],
    queryFn: () => listStockMovementsFn({ data: { sku, limit: 50, offset } }),
  });
}

export function useSlaDashboard() {
  return useQuery({
    queryKey: ["sla-dashboard"],
    queryFn: () => getSlaDashboardFn(),
  });
}

export function useSlaOrders(bucket?: "on_time" | "at_risk" | "breached") {
  return useQuery({
    queryKey: ["sla-orders", bucket ?? "all"],
    queryFn: () => listSlaOrdersFn({ data: bucket ? { bucket } : {} }),
    staleTime: 10_000,
  });
}

export function useExportSlaReportCsv() {
  return useMutation({
    mutationFn: (month?: string) => exportSlaReportCsvFn({ data: month ? { month } : {} }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSlaMonthlyReport(month?: string) {
  return useQuery({
    queryKey: ["sla-monthly-report", month ?? "current"],
    queryFn: () => getSlaMonthlyReportFn({ data: month ? { month } : {} }),
  });
}

export function useGeneratePackingLabel() {
  return useMutation({
    mutationFn: (orderId: string) => generatePackingLabelFn({ data: { orderId } }),
    onSuccess: () => toast.success("Etiqueta gerada"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCarrierPickups() {
  return useQuery({
    queryKey: ["carrier-pickups"],
    queryFn: () => listCarrierPickupsFn(),
    refetchInterval: 60_000,
  });
}

export function useScheduleCarrierPickup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { provider: string; scheduledAt: string; notes?: string }) =>
      scheduleCarrierPickupFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carrier-pickups"] });
      toast.success("Coleta agendada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeliveryHeatMap() {
  return useQuery({
    queryKey: ["delivery-heatmap"],
    queryFn: () => getDeliveryHeatMapFn(),
    staleTime: 60_000,
  });
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: () => listWarehousesFn(),
  });
}

export function useUpsertWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; code: string; isDefault?: boolean }) =>
      upsertWarehouseFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Galpão salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertChannelSlaRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      channel: string;
      dispatchHours: number;
      alertHoursBefore: number;
      trackingDeadlineHours?: number | null;
      penaltyDescription?: string | null;
    }) => upsertChannelSlaRuleFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sla-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

export function usePickWaves() {
  return useQuery({
    queryKey: ["pick-waves"],
    queryFn: () => listPickWavesFn(),
    refetchInterval: 30_000,
  });
}

export function useGeneratePickWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generatePickWaveFn(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      qc.invalidateQueries({ queryKey: ["pick-waves"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (res.waveId) {
        toast.success(`Onda gerada: ${res.waveId.slice(0, 8)}…`);
      } else {
        toast.info("Nenhum pedido elegível para onda");
      }
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
      if (!res.ok) {
        toast.error(res.error ?? "Erro no pick");
        return;
      }
      if (res.taskCompleted) {
        toast.success(
          `Pedido ${res.orderExternalId ?? ""} concluído — pronto para packing`,
        );
      }
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      qc.invalidateQueries({ queryKey: ["pick-waves"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkPickLineNotFound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskLineId: string) => markPickLineNotFoundFn({ data: { taskLineId } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? "Erro ao marcar item");
        return;
      }
      if (res.taskCompleted) {
        toast.warning(
          `Pedido ${res.orderExternalId ?? ""} finalizado com pendências`,
        );
      } else {
        toast.info("Item marcado como não encontrado");
      }
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      qc.invalidateQueries({ queryKey: ["pick-waves"] });
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
      qc.invalidateQueries({ queryKey: ["pick-waves"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Picking concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStartPacking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => startPackingFn({ data: { orderId } }),
    onSuccess: (_res, orderId) => {
      qc.invalidateQueries({ queryKey: ["packing-order-items", orderId] });
      toast.success("Sessão de packing iniciada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePackingOrderItems(orderId: string | undefined) {
  return useQuery({
    queryKey: ["packing-order-items", orderId],
    queryFn: () => getPackingOrderItemsFn({ data: { orderId: orderId! } }),
    enabled: !!orderId,
    refetchInterval: 10_000,
  });
}

export function useConfirmPackingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; sku: string; qty: number }) =>
      confirmPackingItemFn({ data: input }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["packing-order-items", vars.orderId] });
      toast.success("Item embalado");
    },
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
    mutationFn: (input: { returnRequestId: string; refundCents?: number }) =>
      approveReturnFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      toast.success("Devolução aprovada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { returnRequestId: string; reason?: string }) =>
      rejectReturnFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["returns"] });
      toast.success("Solicitação rejeitada");
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
      qc.invalidateQueries({ queryKey: ["ops-receiving-appointments"] });
      qc.invalidateQueries({ queryKey: ["receiving-appointments"] });
      toast.success("Conferência de devolução agendada no galpão");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUploadReturnInspectionPhoto() {
  return useMutation({
    mutationFn: (input: { returnRequestId: string; dataUrl: string }) =>
      uploadReturnInspectionPhotoFn({ data: input }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReturnPolicy() {
  return useQuery({ queryKey: ["return-policy"], queryFn: () => getReturnPolicyFn() });
}

export function useUpsertReturnPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      approvalMode?: "auto" | "manual";
      defaultResolution?: "refund" | "exchange" | "store_credit";
      allowExchange?: boolean;
      allowStoreCredit?: boolean;
      autoApproveExchange?: boolean;
      whatsappPhone?: string;
    }) => upsertReturnPolicyFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["return-policy"] });
      toast.success("Política de devoluções salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReturnRateKpi() {
  return useQuery({ queryKey: ["return-rate-kpi"], queryFn: () => getReturnRateKpiFn() });
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

export function useResolveDeliveryIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (incidentId: string) => resolveDeliveryIncidentFn({ data: { incidentId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-incidents"] });
      toast.success("Incidente resolvido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTrackingQueue() {
  return useQuery({
    queryKey: ["tracking-queue"],
    queryFn: () => listTrackingQueueFn(),
    staleTime: 10_000,
  });
}

export function useOrderTrackingTimeline(orderId: string | null) {
  return useQuery({
    queryKey: ["tracking-timeline", orderId],
    queryFn: () => getOrderTrackingTimelineFn({ data: { orderId: orderId! } }),
    enabled: !!orderId,
  });
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

export function useExportManifestCsv() {
  return useMutation({
    mutationFn: (waveId: string) => exportManifestCsvFn({ data: { waveId } }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDispatchQueue() {
  return useQuery({
    queryKey: ["dispatch-queue"],
    queryFn: () => listDispatchQueueFn(),
    staleTime: 10_000,
  });
}

export function useDispatchOpsOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => dispatchOpsOrderFn({ data: { orderId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["dispatch-queue"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Despachado — rastreio ${res.trackingCode}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useOperatorPerformance() {
  return useQuery({
    queryKey: ["operator-performance"],
    queryFn: () => getOperatorPerformanceFn(),
    staleTime: 60_000,
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
      locationId?: string;
      photoUrl?: string;
      photoDataUrl?: string;
      lotCode?: string;
      expiresAt?: string;
    }) => confirmReceivingLineFn({ data: input }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      qc.invalidateQueries({ queryKey: ["receiving-session", vars.sessionId] });
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

export function useInventoryCounts() {
  return useQuery({
    queryKey: ["inventory-counts"],
    queryFn: () => listInventoryCountsFn(),
  });
}

export function useInventoryCountLines(countId: string | null) {
  return useQuery({
    queryKey: ["inventory-count-lines", countId],
    queryFn: () => getInventoryCountLinesFn({ data: { countId: countId! } }),
    enabled: !!countId,
  });
}

export function useUpsertWmsProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sku: string;
      barcode?: string | null;
      lengthMm?: number | null;
      widthMm?: number | null;
      heightMm?: number | null;
      ncm?: string | null;
      minStockUnits?: number;
      photoUrl?: string | null;
      parentProductId?: string | null;
    }) => upsertWmsProductFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-products"] });
      toast.success("Produto salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUploadProductPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sku: string; dataUrl: string }) => uploadProductPhotoFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wms-products"] });
      toast.success("Foto enviada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertWarehouseLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      aisle: string;
      shelf: string;
      level?: string;
      binCode: string;
      routeOrder?: number;
      id?: string;
    }) => upsertWarehouseLocationFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouse-locations"] });
      toast.success("Posição salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLocationStock(locationId?: string) {
  return useQuery({
    queryKey: ["location-stock", locationId],
    queryFn: () => listLocationStockFn({ data: { locationId } }),
  });
}

export function useStockAlerts() {
  return useQuery({
    queryKey: ["stock-alerts"],
    queryFn: () => listStockAlertSkusFn(),
    staleTime: 60_000,
  });
}

export function useProductVariations(parentProductId: string | null) {
  return useQuery({
    queryKey: ["product-variations", parentProductId],
    queryFn: () => listProductVariationsFn({ data: { parentProductId: parentProductId! } }),
    enabled: !!parentProductId,
  });
}

export function useExpiringLots() {
  return useQuery({
    queryKey: ["expiring-lots"],
    queryFn: () => listExpiringLotsFn(),
  });
}

export function useQuarantineItems() {
  return useQuery({
    queryKey: ["quarantine-items"],
    queryFn: () => listQuarantineItemsFn(),
  });
}

export function useReleaseQuarantine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => releaseQuarantineItemFn({ data: { itemId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarantine-items"] });
      toast.success("Item liberado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDiscardQuarantine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => discardQuarantineItemFn({ data: { itemId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quarantine-items"] });
      toast.success("Item descartado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStockTurnover() {
  return useQuery({
    queryKey: ["stock-turnover"],
    queryFn: () => listStockTurnoverFn(),
  });
}

export function useRecentStockSyncs() {
  return useQuery({
    queryKey: ["stock-syncs"],
    queryFn: () => listRecentStockSyncsFn(),
  });
}

export function useStartReceivingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string | null) =>
      startReceivingSessionFn({ data: { appointmentId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops-receiving-appointments"] });
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompleteReceivingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => completeReceivingSessionFn({ data: { sessionId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ops-tasks"] });
      qc.invalidateQueries({ queryKey: ["receiving-appointments"] });
      qc.invalidateQueries({ queryKey: ["receiving-reports"] });
      toast.success("Recebimento concluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useOpsReceivingAppointments() {
  return useQuery({
    queryKey: ["ops-receiving-appointments"],
    queryFn: () => listOpsReceivingAppointmentsFn(),
    refetchInterval: 30_000,
  });
}

export function useReceivingSessionContext(sessionId: string | null) {
  return useQuery({
    queryKey: ["receiving-session", sessionId],
    queryFn: () => getReceivingSessionContextFn({ data: { sessionId: sessionId! } }),
    enabled: !!sessionId,
  });
}

export function useReceivingAppointments() {
  return useQuery({
    queryKey: ["receiving-appointments"],
    queryFn: () => listReceivingAppointmentsFn(),
  });
}

export function useReceivingReports(from?: string, to?: string) {
  return useQuery({
    queryKey: ["receiving-reports", from, to],
    queryFn: () => listReceivingReportsFn({ data: { from, to } }),
  });
}

export function useExportReceivingReport() {
  return useMutation({
    mutationFn: (input: { from?: string; to?: string }) => exportReceivingReportFn({ data: input }),
    onSuccess: (res) => {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recebimentos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useStartInventoryCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      countType: "rotativo" | "geral";
      skus?: string[];
      aisle?: string;
      locationId?: string;
    }) => startInventoryCountFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-counts"] });
      toast.success("Inventário iniciado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecordInventoryCountLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { countId: string; sku: string; countedQty: number }) =>
      recordInventoryCountLineFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-count-lines"] });
      toast.success("Contagem registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompleteInventoryCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (countId: string) => completeInventoryCountFn({ data: { countId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["inventory-counts"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(`${res.adjusted} SKU(s) ajustados`);
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

export function useLogisticsAnalyticsDashboard() {
  return useQuery({
    queryKey: ["logistics-analytics-dashboard"],
    queryFn: () => getLogisticsAnalyticsDashboardFn(),
    staleTime: 60_000,
  });
}

export function useUnifiedOccurrences() {
  return useQuery({
    queryKey: ["unified-occurrences"],
    queryFn: () => listUnifiedOccurrencesFn(),
    staleTime: 30_000,
  });
}

export function useExportOccurrencesCsv() {
  return useMutation({
    mutationFn: () => exportOccurrencesCsvFn(),
    onSuccess: (res) => {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Ocorrências exportadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useOpsLiveDashboard() {
  return useQuery({
    queryKey: ["ops-live-dashboard"],
    queryFn: () => getOpsLiveDashboardFn(),
    refetchInterval: 15_000,
  });
}

export function useExportLogisticsAnalyticsCsv() {
  return useMutation({
    mutationFn: () => exportLogisticsAnalyticsCsvFn(),
    onSuccess: (res) => {
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logistics-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório exportado");
    },
    onError: (e: Error) => toast.error(e.message),
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
      requestType?: "return" | "exchange";
      exchangeSku?: string;
      exchangeQty?: number;
      resolution?: "refund" | "exchange" | "store_credit";
      refundCents?: number;
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
      qc.invalidateQueries({ queryKey: ["receiving-appointments"] });
      qc.invalidateQueries({ queryKey: ["ops-receiving-appointments"] });
      toast.success("Recebimento agendado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
