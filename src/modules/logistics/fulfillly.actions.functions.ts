import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adjustStock, listStockMovements } from "./wms/stock-movements.server";
import { logAudit } from "@/shared/lib/logger";
import {
  listWarehouseLocations,
  listWmsProducts,
  upsertWarehouseLocation,
  upsertWmsProduct,
  uploadProductPhoto,
  deactivateWarehouseLocation,
  listLocationStock,
  assignSkuToLocation,
  listStockAlertSkus,
  listProductVariations,
} from "./wms/warehouse.server";
import {
  listExpiringLots,
  listProductLots,
  upsertProductLot,
  deleteProductLot,
} from "./wms/product-lots.server";
import {
  listQuarantineItems,
  releaseQuarantineItem,
  discardQuarantineItem,
} from "./wms/quarantine.server";
import { listStockTurnover } from "./wms/stock-turnover.server";
import { listRecentStockSyncs } from "@/modules/catalog/stock-sync-outbox.server";
import {
  createReceivingAppointment,
  startReceivingSession,
  confirmReceivingLine,
  completeReceivingSession,
  listReceivingAppointments,
  listOpsReceivingAppointments,
  getReceivingSessionContext,
  uploadReceivingPhoto,
  listReceivingReports,
  exportReceivingReportCsv,
} from "./receiving/receiving.server";
import {
  generatePickWave,
  confirmPickLine,
  completePickTask,
  listPickWaves,
  markPickLineNotFound,
} from "./picking/wave-generator.server";
import {
  startPackingSession,
  confirmPackingItem,
  completePackingSession,
  getPackingOrderItems,
} from "./packing/packing.server";
import { getOperatorPerformance } from "./ops/operator-performance.server";
import {
  getSlaDashboard,
  listSlaAtRiskOrders,
  listChannelSlaRules,
  upsertChannelSlaRule,
} from "./sla/sla-engine.server";
import { buildSlaMonthlyReport, exportSlaReportCsv } from "./sla/sla-report.server";
import {
  createReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
  inspectReturn,
  listReturnRequests,
  scheduleReturnReceiving,
  setReturnRefundAmount,
  uploadReturnInspectionPhoto,
  getReturnRateKpi,
} from "./returns/returns.server";
import { getReturnPolicy, upsertReturnPolicy } from "./returns/return-policy.server";
import { predictStockRupture } from "./wms/stock-rupture.server";
import {
  listDeliveryIncidents,
  buildIncidentHeatMap,
  resolveDeliveryIncident,
} from "./shipping/delivery-incidents.server";
import {
  listTrackingQueue,
  getOrderTrackingTimeline,
  getTrackingStats,
} from "./shipping/tracking-timeline.server";
import {
  generateLabelsForWave,
  buildDispatchManifest,
  exportManifestCsv,
} from "./shipping/batch-labels.server";
import { listDispatchQueue } from "./shipping/dispatch-queue.server";
import {
  listClientCarrierConfigs,
  listAvailableCarrierProviders,
  listClientOAuthConnections,
  upsertClientCarrierConfig,
} from "./shipping/carrier-config.server";
import {
  getPackingProfile,
  upsertPackingProfile,
} from "./packing/packing-profile.server";
import { getReturnReasonsReport } from "./returns/returns.server";
import { getLogisticsAnalytics } from "./analytics/logistics-analytics.server";
import { getLogisticsAnalyticsDashboard } from "./analytics/logistics-dashboard.server";
import { exportLogisticsAnalyticsCsv } from "./analytics/export-logistics-analytics.server";
import { getOpsPickQueue, getOpsPickOrderProgress } from "./ops/ops-tasks.server";
import {
  startInventoryCount,
  recordCountLine,
  completeInventoryCount,
  listInventoryCounts,
  getInventoryCountLines,
  exportCountReport,
} from "./wms/inventory-count.server";

async function requireStaff(
  userId: string,
  supabase: { from: (t: string) => ReturnType<typeof supabaseAdmin.from> },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
    throw new Error("Apenas equipe Orbia.");
  }
}

async function getClientIdForUser(
  userId: string,
  supabase: { from: (t: string) => ReturnType<typeof supabaseAdmin.from> },
  explicitClientId?: string,
): Promise<string> {
  if (explicitClientId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (profile && ["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
      return explicitClientId;
    }
    const { data: membership } = await supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", userId)
      .eq("client_id", explicitClientId)
      .eq("status", "active")
      .maybeSingle();
    if (membership?.client_id) return explicitClientId;
  }

  const { data } = await supabase
    .from("client_members")
    .select("client_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data?.client_id) throw new Error("Cliente não encontrado");
  return data.client_id as string;
}

export const listWarehouseLocationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listWarehouseLocations(clientId);
  });

export const listWmsProductsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listWmsProducts(clientId);
  });

const locationSchema = z.object({
  aisle: z.string(),
  shelf: z.string(),
  level: z.string().default("1"),
  binCode: z.string(),
  routeOrder: z.number().default(0),
  warehouseId: z.string().uuid().nullable().optional(),
  id: z.string().uuid().optional(),
});

export const upsertWarehouseLocationFn = createServerFn({ method: "POST" })
  .inputValidator(locationSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return upsertWarehouseLocation(clientId, data);
  });

const adjustSchema = z.object({
  sku: z.string(),
  delta: z.number(),
  reason: z.string().min(3),
});

export const adjustStockFn = createServerFn({ method: "POST" })
  .inputValidator(adjustSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return adjustStock(clientId, data.sku, data.delta, data.reason, context.userId);
  });

const stockMovementsQuerySchema = z.object({
  sku: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const listStockMovementsFn = createServerFn({ method: "POST" })
  .inputValidator(stockMovementsQuerySchema.optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const params = data ?? { limit: 50, offset: 0 };
    const rows = await listStockMovements(clientId, params.sku, params.limit + params.offset);
    return rows.slice(params.offset, params.offset + params.limit);
  });

export const generatePickWaveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const waveId = await generatePickWave(clientId, context.userId);
    return { waveId };
  });

export const listPickWavesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listPickWaves(clientId);
  });

const pickLineSchema = z.object({
  taskLineId: z.string().uuid(),
  barcode: z.string(),
});

export const confirmPickLineFn = createServerFn({ method: "POST" })
  .inputValidator(pickLineSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return confirmPickLine(clientId, data.taskLineId, data.barcode, context.userId);
  });

export const markPickLineNotFoundFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ taskLineId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return markPickLineNotFound(clientId, data.taskLineId, context.userId);
  });

const taskSchema = z.object({ taskId: z.string().uuid() });

export const completePickTaskFn = createServerFn({ method: "POST" })
  .inputValidator(taskSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await completePickTask(clientId, data.taskId, context.userId);
    return { ok: true };
  });

const orderSchema = z.object({ orderId: z.string().uuid() });

export const startPackingFn = createServerFn({ method: "POST" })
  .inputValidator(orderSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => startPackingSession(data.orderId, context.userId));

const packItemSchema = z.object({
  orderId: z.string().uuid(),
  sku: z.string(),
  qty: z.number().positive(),
});

export const confirmPackingItemFn = createServerFn({ method: "POST" })
  .inputValidator(packItemSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => confirmPackingItem(data.orderId, data.sku, data.qty));

const completePackSchema = z.object({
  sessionId: z.string().uuid(),
  photoUrls: z.array(z.string()).optional(),
});

export const completePackingFn = createServerFn({ method: "POST" })
  .inputValidator(completePackSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => completePackingSession(data.sessionId, data.photoUrls));

export const getPackingOrderItemsFn = createServerFn({ method: "POST" })
  .inputValidator(orderSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("client_id")
      .eq("id", data.orderId)
      .single();
    if (!order || order.client_id !== clientId) throw new Error("Pedido não encontrado");
    return getPackingOrderItems(data.orderId);
  });

export const dispatchOpsOrderFn = createServerFn({ method: "POST" })
  .inputValidator(orderSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("client_id")
      .eq("id", data.orderId)
      .single();
    if (!order || order.client_id !== clientId) throw new Error("Pedido não encontrado");
    const { dispatchOrder } = await import("./shipping/dispatch.server");
    return dispatchOrder(data.orderId, context.userId);
  });

export const getOperatorPerformanceFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return getOperatorPerformance(clientId);
  });

export const getSlaDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const [dashboard, rules] = await Promise.all([
      getSlaDashboard(clientId),
      listChannelSlaRules(clientId),
    ]);
    return { ...dashboard, rules };
  });

export const listSlaOrdersFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      bucket: z.enum(["on_time", "at_risk", "breached"]).optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listSlaAtRiskOrders(clientId, data.bucket);
  });

export const exportSlaReportCsvFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ month: z.string().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return { csv: await exportSlaReportCsv(clientId, data.month) };
  });

export const getSlaMonthlyReportFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ month: z.string().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return buildSlaMonthlyReport(clientId, data.month);
  });

export const upsertChannelSlaRuleFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      channel: z.string().min(1),
      dispatchHours: z.number().int().positive(),
      alertHoursBefore: z.number().int().positive(),
      clientId: z.string().uuid().nullable().optional(),
      trackingDeadlineHours: z.number().int().positive().nullable().optional(),
      penaltyDescription: z.string().nullable().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const tenantId = await getClientIdForUser(context.userId, context.supabase);
    await upsertChannelSlaRule({
      channel: data.channel,
      dispatchHours: data.dispatchHours,
      alertHoursBefore: data.alertHoursBefore,
      clientId: data.clientId ?? tenantId,
      trackingDeadlineHours: data.trackingDeadlineHours,
      penaltyDescription: data.penaltyDescription,
    });
    return { ok: true };
  });

const receivingSchema = z.object({
  scheduledAt: z.string(),
  expectedItems: z.array(z.object({ sku: z.string(), qty: z.number() })),
});

export const createReceivingAppointmentFn = createServerFn({ method: "POST" })
  .inputValidator(receivingSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return createReceivingAppointment(clientId, data.scheduledAt, data.expectedItems);
  });

const receiveLineSchema = z.object({
  sessionId: z.string().uuid(),
  sku: z.string(),
  expectedQty: z.number(),
  receivedQty: z.number(),
  barcodeScanned: z.string().optional(),
  locationId: z.string().uuid().optional(),
  photoUrl: z.string().optional(),
  photoDataUrl: z.string().optional(),
  lotCode: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const startReceivingSessionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ appointmentId: z.string().uuid().nullable() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return startReceivingSession(clientId, data.appointmentId, context.userId);
  });

export const confirmReceivingLineFn = createServerFn({ method: "POST" })
  .inputValidator(receiveLineSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    let photoUrl = data.photoUrl;
    if (data.photoDataUrl) {
      photoUrl = await uploadReceivingPhoto(
        clientId,
        data.sessionId,
        data.sku,
        data.photoDataUrl,
      );
    }
    await confirmReceivingLine(
      clientId,
      data.sessionId,
      {
        sku: data.sku,
        expectedQty: data.expectedQty,
        receivedQty: data.receivedQty,
        barcodeScanned: data.barcodeScanned,
        locationId: data.locationId,
        photoUrl,
        lotCode: data.lotCode,
        expiresAt: data.expiresAt,
      },
      context.userId,
    );
    return { ok: true };
  });

export const completeReceivingSessionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await completeReceivingSession(clientId, data.sessionId);
    return { ok: true };
  });

export const listReceivingAppointmentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listReceivingAppointments(clientId);
  });

export const listOpsReceivingAppointmentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listOpsReceivingAppointments(clientId);
  });

export const getReceivingSessionContextFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ sessionId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => getReceivingSessionContext(data.sessionId));

export const listReceivingReportsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ from: z.string().optional(), to: z.string().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listReceivingReports(clientId, data.from, data.to);
  });

export const exportReceivingReportFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ from: z.string().optional(), to: z.string().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return { csv: await exportReceivingReportCsv(clientId, data.from, data.to) };
  });

export const getOpsTasksFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);

    const [pickLines, pickOrderProgress, appointments] = await Promise.all([
      getOpsPickQueue(clientId),
      getOpsPickOrderProgress(clientId),
      supabaseAdmin
        .from("receiving_appointments")
        .select("id, scheduled_at, status, expected_items, appointment_type")
        .eq("client_id", clientId)
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_at")
        .limit(10),
    ]);

    return {
      pickLines,
      pickOrderProgress,
      receivingAppointments: appointments.data ?? [],
    };
  });

const returnSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string(),
  items: z.array(z.object({ sku: z.string(), qty: z.number() })),
  requestType: z.enum(["return", "exchange"]).optional(),
  exchangeSku: z.string().optional(),
  exchangeQty: z.number().optional(),
  resolution: z.enum(["refund", "exchange", "store_credit"]).optional(),
  refundCents: z.number().optional(),
});

export const createReturnRequestFn = createServerFn({ method: "POST" })
  .inputValidator(returnSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return createReturnRequest({
      clientId,
      orderId: data.orderId,
      reason: data.reason,
      items: data.items,
      requestType: data.requestType,
      exchangeSku: data.exchangeSku,
      exchangeQty: data.exchangeQty,
      resolution: data.resolution,
      refundCents: data.refundCents,
    });
  });

export const approveReturnFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      returnRequestId: z.string().uuid(),
      refundCents: z.number().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    if (data.refundCents != null) {
      await setReturnRefundAmount(data.returnRequestId, data.refundCents, context.userId);
    }
    await approveReturnRequest(data.returnRequestId, context.userId);
    return { ok: true };
  });

export const rejectReturnFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      returnRequestId: z.string().uuid(),
      reason: z.string().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await rejectReturnRequest(data.returnRequestId, context.userId, data.reason);
    return { ok: true };
  });

export const listReturnsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listReturnRequests(clientId);
  });

export const scheduleReturnReceivingFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ returnRequestId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const appointmentId = await scheduleReturnReceiving(data.returnRequestId);
    return { ok: true, appointmentId };
  });

/** @deprecated Use scheduleReturnReceivingFn */
export const markReturnReceivedFn = scheduleReturnReceivingFn;

const inspectReturnSchema = z.object({
  returnRequestId: z.string().uuid(),
  destination: z.enum(["reintegrate", "quarantine", "discard"]),
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
});

export const inspectReturnFn = createServerFn({ method: "POST" })
  .inputValidator(inspectReturnSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await inspectReturn({
      returnRequestId: data.returnRequestId,
      inspectorId: context.userId,
      destination: data.destination,
      notes: data.notes,
      photoUrls: data.photoUrls,
    });
    return { ok: true };
  });

export const uploadReturnInspectionPhotoFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      returnRequestId: z.string().uuid(),
      dataUrl: z.string(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const url = await uploadReturnInspectionPhoto(clientId, data.returnRequestId, data.dataUrl);
    return { url };
  });

const returnPolicySchema = z.object({
  approvalMode: z.enum(["auto", "manual"]).optional(),
  defaultResolution: z.enum(["refund", "exchange", "store_credit"]).optional(),
  allowExchange: z.boolean().optional(),
  allowStoreCredit: z.boolean().optional(),
  autoApproveExchange: z.boolean().optional(),
  whatsappPhone: z.string().optional(),
});

export const getReturnPolicyFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return getReturnPolicy(clientId);
  });

export const upsertReturnPolicyFn = createServerFn({ method: "POST" })
  .inputValidator(returnPolicySchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return upsertReturnPolicy(clientId, data);
  });

export const getReturnRateKpiFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return getReturnRateKpi(clientId);
  });

export const getStockRuptureFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return predictStockRupture(clientId);
  });

export const getDeliveryIncidentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const incidents = await listDeliveryIncidents(clientId);
    return { incidents, heatMap: buildIncidentHeatMap(incidents) };
  });

export const resolveDeliveryIncidentFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ incidentId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    await resolveDeliveryIncident(data.incidentId);
    return { ok: true };
  });

export const listTrackingQueueFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const [queue, stats] = await Promise.all([
      listTrackingQueue(clientId),
      getTrackingStats(clientId),
    ]);
    return { queue, stats };
  });

export const getOrderTrackingTimelineFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => getOrderTrackingTimeline(data.orderId));

export const generateWaveLabelsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ waveId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => generateLabelsForWave(data.waveId));

export const getDispatchManifestFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ waveId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => buildDispatchManifest(data.waveId));

export const exportManifestCsvFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ waveId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => ({ csv: await exportManifestCsv(data.waveId) }));

export const listDispatchQueueFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listDispatchQueue(clientId);
  });

export const listCarrierConfigsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const [configs, providers, oauthConnections] = await Promise.all([
      listClientCarrierConfigs(clientId),
      Promise.resolve(listAvailableCarrierProviders()),
      listClientOAuthConnections(clientId),
    ]);
    return { configs, providers, oauthConnections };
  });

const carrierConfigSchema = z.object({
  provider: z.string().min(1),
  isActive: z.boolean(),
  priority: z.number().int().min(0),
  autoSelect: z.boolean(),
  credentialsRef: z.string().optional(),
});

export const upsertCarrierConfigFn = createServerFn({ method: "POST" })
  .inputValidator(carrierConfigSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const id = await upsertClientCarrierConfig(clientId, data);
    return { id };
  });

export const getReturnReasonsReportFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return getReturnReasonsReport(clientId);
  });

export const getLogisticsAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return getLogisticsAnalytics(clientId);
  });

export const getLogisticsAnalyticsDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return getLogisticsAnalyticsDashboard(clientId);
  });

export const exportLogisticsAnalyticsCsvFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return { csv: await exportLogisticsAnalyticsCsv(clientId) };
  });

export const listInventoryCountsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listInventoryCounts(clientId);
  });

export const getInventoryCountLinesFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ countId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => getInventoryCountLines(data.countId));

const startCountSchema = z.object({
  countType: z.enum(["rotativo", "geral"]),
  skus: z.array(z.string()).optional(),
  aisle: z.string().optional(),
  locationId: z.string().uuid().optional(),
});

export const startInventoryCountFn = createServerFn({ method: "POST" })
  .inputValidator(startCountSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const id = await startInventoryCount(clientId, data.countType, context.userId, {
      skus: data.skus,
      aisle: data.aisle,
      locationId: data.locationId,
    });
    return { id };
  });

const recordCountSchema = z.object({
  countId: z.string().uuid(),
  sku: z.string(),
  countedQty: z.number().int().min(0),
  locationId: z.string().uuid().optional(),
});

export const recordInventoryCountLineFn = createServerFn({ method: "POST" })
  .inputValidator(recordCountSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    await recordCountLine(data.countId, data.sku, data.countedQty, data.locationId);
    return { ok: true };
  });

export const exportInventoryCountFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ countId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => ({ csv: await exportCountReport(data.countId) }));

export const completeInventoryCountFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ countId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return completeInventoryCount(clientId, data.countId, context.userId);
  });

const wmsProductSchema = z.object({
  sku: z.string(),
  barcode: z.string().nullable().optional(),
  lengthMm: z.number().nullable().optional(),
  widthMm: z.number().nullable().optional(),
  heightMm: z.number().nullable().optional(),
  ncm: z.string().nullable().optional(),
  minStockUnits: z.number().int().min(0).optional(),
  photoUrl: z.string().nullable().optional(),
  parentProductId: z.string().uuid().nullable().optional(),
});

export const upsertWmsProductFn = createServerFn({ method: "POST" })
  .inputValidator(wmsProductSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const id = await upsertWmsProduct(clientId, data);
    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "product",
      resource_id: data.sku,
      new_data: data,
    });
    return { id };
  });

export const uploadProductPhotoFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sku: z.string(), dataUrl: z.string() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const url = await uploadProductPhoto(clientId, data.sku, data.dataUrl);
    return { url };
  });

export const deactivateWarehouseLocationFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await deactivateWarehouseLocation(clientId, data.id);
    return { ok: true };
  });

export const listLocationStockFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ locationId: z.string().uuid().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listLocationStock(clientId, data?.locationId);
  });

const assignSkuSchema = z.object({
  sku: z.string(),
  locationId: z.string().uuid(),
  qty: z.number().int().positive(),
  lotId: z.string().uuid().nullable().optional(),
});

export const assignSkuToLocationFn = createServerFn({ method: "POST" })
  .inputValidator(assignSkuSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await assignSkuToLocation(clientId, data.sku, data.locationId, data.qty, data.lotId);
    return { ok: true };
  });

export const listStockAlertSkusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listStockAlertSkus(clientId);
  });

export const listProductVariationsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ parentProductId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listProductVariations(clientId, data.parentProductId);
  });

export const listExpiringLotsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listExpiringLots(clientId);
  });

export const listQuarantineItemsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listQuarantineItems(clientId);
  });

export const releaseQuarantineItemFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ itemId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await releaseQuarantineItem(clientId, data.itemId, context.userId);
    return { ok: true };
  });

export const discardQuarantineItemFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ itemId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await discardQuarantineItem(clientId, data.itemId, context.userId);
    return { ok: true };
  });

export const listStockTurnoverFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listStockTurnover(clientId);
  });

export const listRecentStockSyncsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listRecentStockSyncs(clientId);
  });

export const checkOpsAccessFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    if (profile && ["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
      return { allowed: true as const, role: profile.role as string };
    }

    const { data: membership } = await context.supabase
      .from("client_members")
      .select("role, client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();

    const opsRoles = new Set(["owner", "admin", "manager", "fulfillment_operator"]);
    if (membership && opsRoles.has(membership.role as string)) {
      return {
        allowed: true as const,
        role: membership.role as string,
        clientId: membership.client_id as string,
      };
    }

    return { allowed: false as const, role: (membership?.role as string | null) ?? null };
  });

export const getClientLogisticsReportFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const { buildClientLogisticsReport } = await import(
      "./analytics/client-logistics-report.server"
    );
    return buildClientLogisticsReport(data.clientId);
  });

export const exportClientLogisticsQbrFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const { exportClientQbrCsv } = await import("./analytics/client-qbr-report.server");
    return { csv: await exportClientQbrCsv(data.clientId) };
  });

export const exportClientLogisticsQbrHtmlFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const { buildClientQbrReportHtml } = await import("./analytics/client-qbr-report.server");
    return { html: await buildClientQbrReportHtml(data.clientId) };
  });

export const exportClientLogisticsQbrPdfFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const { buildQbrReportPdf, pdfToBase64 } = await import("@/modules/analytics/pdf-report.server");
    const pdf = await buildQbrReportPdf(data.clientId);
    return {
      pdfBase64: pdfToBase64(pdf),
      filename: `qbr-fulfillly-${data.clientId.slice(0, 8)}.pdf`,
    };
  });

export const updateOperatorScopeFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      memberUserId: z.string().uuid(),
      allowedSkus: z.array(z.string()).optional(),
      warehouseId: z.string().uuid().nullable().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { updateOperatorScope } = await import("./ops/operator-scope.server");
    await updateOperatorScope(clientId, data.memberUserId, {
      allowedSkus: data.allowedSkus,
      warehouseId: data.warehouseId,
    });
    return { ok: true };
  });

export const listMarketplacePenaltiesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { listMarketplacePenalties } = await import("./sla/marketplace-penalties-list.server");
    return listMarketplacePenalties(clientId);
  });

export const sendSlaMonthlyReportEmailFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      month: z.string().optional(),
      email: z.string().email().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    let toEmail = data.email;
    if (!toEmail) {
      const { data: userData } = await context.supabase.auth.getUser();
      toEmail = userData.user?.email ?? undefined;
    }
    if (!toEmail) throw new Error("E-mail do destinatário não encontrado");

    const { sendSlaMonthlyReportEmail } = await import("./sla/sla-report-email.server");
    const result = await sendSlaMonthlyReportEmail(clientId, toEmail, data.month);
    if (!result.sent) throw new Error("Resend não configurado — exporte o HTML manualmente");
    return result;
  });

export const exportSlaMonthlyReportHtmlFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ month: z.string().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { buildSlaMonthlyReportHtml } = await import("./sla/sla-report-email.server");
    return { html: await buildSlaMonthlyReportHtml(clientId, data.month) };
  });

export const listProductLotsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listProductLots(clientId);
  });

export const upsertProductLotFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sku: z.string().min(1),
      lotCode: z.string().min(1),
      expiresAt: z.string().nullable().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const id = await upsertProductLot(clientId, data);
    return { id };
  });

export const deleteProductLotFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ lotId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await deleteProductLot(clientId, data.lotId);
    return { ok: true };
  });

export const listUnifiedOccurrencesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { listUnifiedOccurrences } = await import("./analytics/occurrences-report.server");
    return listUnifiedOccurrences(clientId);
  });

export const exportOccurrencesCsvFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { exportOccurrencesCsv } = await import("./analytics/occurrences-report.server");
    return { csv: await exportOccurrencesCsv(clientId) };
  });

export const getOpsLiveDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { getOpsLiveDashboard } = await import("./ops/ops-live-dashboard.server");
    return getOpsLiveDashboard(clientId);
  });

export const getClientSlaRulesFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    return listChannelSlaRules(data.clientId);
  });

const clientSlaRuleSchema = z.object({
  clientId: z.string().uuid(),
  channel: z.string().min(1),
  dispatchHours: z.number().int().min(1),
  alertHoursBefore: z.number().int().min(0),
  trackingDeadlineHours: z.number().int().nullable().optional(),
  penaltyDescription: z.string().nullable().optional(),
});

export const upsertClientSlaRuleFn = createServerFn({ method: "POST" })
  .inputValidator(clientSlaRuleSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    await upsertChannelSlaRule({
      channel: data.channel,
      dispatchHours: data.dispatchHours,
      alertHoursBefore: data.alertHoursBefore,
      clientId: data.clientId,
      trackingDeadlineHours: data.trackingDeadlineHours,
      penaltyDescription: data.penaltyDescription,
    });
    return { ok: true };
  });

export const getPackingProfileFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = data.clientId
      ? await getClientIdForUser(context.userId, context.supabase, data.clientId)
      : await getClientIdForUser(context.userId, context.supabase);
    return getPackingProfile(clientId);
  });

const packingProfileSchema = z.object({
  clientId: z.string().uuid().optional(),
  checklistItems: z.array(z.string()).min(1),
  brandingUrl: z.string().nullable().optional(),
  insertMaterialSku: z.string().nullable().optional(),
});

export const upsertPackingProfileFn = createServerFn({ method: "POST" })
  .inputValidator(packingProfileSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = data.clientId
      ? await getClientIdForUser(context.userId, context.supabase, data.clientId)
      : await getClientIdForUser(context.userId, context.supabase);
    return upsertPackingProfile(clientId, {
      checklistItems: data.checklistItems,
      brandingUrl: data.brandingUrl,
      insertMaterialSku: data.insertMaterialSku,
    });
  });

export const generatePackingLabelFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { purchasePackingLabel } = await import("./shipping/packing-label.server");
    return purchasePackingLabel(data.orderId, context.userId);
  });

export const listCarrierPickupsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { listCarrierPickups } = await import("./shipping/pickup.server");
    return listCarrierPickups(clientId);
  });

export const scheduleCarrierPickupFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      provider: z.string().min(1),
      scheduledAt: z.string(),
      notes: z.string().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { scheduleCarrierPickup } = await import("./shipping/pickup.server");
    return scheduleCarrierPickup(clientId, data, context.userId);
  });

export const getDeliveryHeatMapFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { buildDeliveryHeatMap } = await import("./analytics/delivery-heatmap.server");
    return buildDeliveryHeatMap(clientId);
  });

export const listWarehousesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { listWarehouses, ensureDefaultWarehouse } = await import("./wms/warehouses.server");
    const warehouses = await listWarehouses(clientId);
    if (warehouses.length === 0) {
      await ensureDefaultWarehouse(clientId);
      return listWarehouses(clientId);
    }
    return warehouses;
  });

export const upsertWarehouseFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      code: z.string().min(1),
      isDefault: z.boolean().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    const { upsertWarehouse } = await import("./wms/warehouses.server");
    return upsertWarehouse(clientId, data, context.userId);
  });
