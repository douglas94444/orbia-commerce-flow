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
import { listExpiringLots } from "./wms/product-lots.server";
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
} from "./packing/packing.server";
import { getSlaDashboard } from "./sla/sla-engine.server";
import {
  createReturnRequest,
  approveReturnRequest,
  inspectReturn,
  listReturnRequests,
  markReturnReceived,
} from "./returns/returns.server";
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
  upsertClientCarrierConfig,
} from "./shipping/carrier-config.server";
import { getReturnReasonsReport } from "./returns/returns.server";
import { getLogisticsAnalytics } from "./analytics/logistics-analytics.server";
import { getOpsPickQueue, getOpsPickOrderProgress } from "./ops/ops-tasks.server";
import {
  startInventoryCount,
  recordCountLine,
  completeInventoryCount,
  listInventoryCounts,
  getInventoryCountLines,
  exportCountReport,
} from "./wms/inventory-count.server";

async function getClientIdForUser(
  userId: string,
  supabase: { from: (t: string) => ReturnType<typeof supabaseAdmin.from> },
): Promise<string> {
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
    const waveId = await generatePickWave(clientId);
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

export const getSlaDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return getSlaDashboard(clientId);
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
    });
  });

export const approveReturnFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ returnRequestId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await approveReturnRequest(data.returnRequestId, context.userId);
    return { ok: true };
  });

export const listReturnsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listReturnRequests(clientId);
  });

export const markReturnReceivedFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ returnRequestId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const appointmentId = await markReturnReceived(data.returnRequestId);
    return { ok: true, appointmentId };
  });

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
    const [configs, providers] = await Promise.all([
      listClientCarrierConfigs(clientId),
      Promise.resolve(listAvailableCarrierProviders()),
    ]);
    return { configs, providers };
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
