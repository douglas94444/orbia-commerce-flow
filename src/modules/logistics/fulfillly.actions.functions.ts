import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adjustStock, listStockMovements } from "./wms/stock-movements.server";
import {
  listWarehouseLocations,
  listWmsProducts,
  upsertWarehouseLocation,
} from "./wms/warehouse.server";
import {
  createReceivingAppointment,
  startReceivingSession,
  confirmReceivingLine,
  completeReceivingSession,
} from "./receiving/receiving.server";
import { generatePickWave, confirmPickLine, completePickTask } from "./picking/wave-generator.server";
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
} from "./returns/returns.server";

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

export const listStockMovementsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return listStockMovements(clientId);
  });

export const generatePickWaveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    return generatePickWave(clientId);
  });

const pickLineSchema = z.object({
  taskLineId: z.string().uuid(),
  barcode: z.string(),
});

export const confirmPickLineFn = createServerFn({ method: "POST" })
  .inputValidator(pickLineSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => confirmPickLine(data.taskLineId, data.barcode, context.userId));

const taskSchema = z.object({ taskId: z.string().uuid() });

export const completePickTaskFn = createServerFn({ method: "POST" })
  .inputValidator(taskSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => completePickTask(data.taskId));

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
});

export const confirmReceivingLineFn = createServerFn({ method: "POST" })
  .inputValidator(receiveLineSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);
    await confirmReceivingLine(
      clientId,
      data.sessionId,
      {
        sku: data.sku,
        expectedQty: data.expectedQty,
        receivedQty: data.receivedQty,
        barcodeScanned: data.barcodeScanned,
        locationId: data.locationId,
      },
      context.userId,
    );
    return { ok: true };
  });

export const getOpsTasksFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await getClientIdForUser(context.userId, context.supabase);

    const { data: waves } = await supabaseAdmin
      .from("pick_waves")
      .select("id")
      .eq("client_id", clientId)
      .in("status", ["open", "in_progress"]);

    const waveIds = (waves ?? []).map((w: { id: string }) => w.id);

    const [picks, appointments] = await Promise.all([
      waveIds.length ?
        supabaseAdmin
          .from("pick_tasks")
          .select("id, status, order_id")
          .in("wave_id", waveIds)
          .in("status", ["pending", "in_progress"])
          .limit(20)
      : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("receiving_appointments")
        .select("id, scheduled_at, status")
        .eq("client_id", clientId)
        .eq("status", "scheduled")
        .limit(10),
    ]);

    return {
      pickTasks: picks.data ?? [],
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
