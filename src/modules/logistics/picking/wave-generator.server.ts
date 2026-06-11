import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { logAudit } from "@/shared/lib/logger";
import { getSkuLocationsFefo, listWarehouseLocations } from "../wms/warehouse.server";
import { recordFulfillmentUsage } from "../forecast/volume-forecast.server";
import { optimizePickRoute } from "./route-optimizer.server";
import { decrementLocationStock, recordPickStockMovement } from "./pick-stock.server";

export interface PickWaveRow {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  taskCount: number;
  completedTaskCount: number;
  pendingLineCount: number;
}

export interface ConfirmPickResult {
  ok: boolean;
  error?: string;
  taskCompleted?: boolean;
  orderExternalId?: string;
  waveCompleted?: boolean;
}

const TERMINAL_LINE_STATUSES = ["picked", "not_found", "skipped"] as const;

async function getBusyOrderIds(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("pick_tasks")
    .select("order_id")
    .in("status", ["pending", "in_progress"]);

  return new Set((data ?? []).map((t) => t.order_id as string));
}

async function maybeCompleteWave(waveId: string): Promise<boolean> {
  const { data: tasks } = await supabaseAdmin
    .from("pick_tasks")
    .select("status")
    .eq("wave_id", waveId);

  if (!tasks?.length) return false;

  const allDone = tasks.every(
    (t) => t.status === "completed" || t.status === "issue",
  );

  if (allDone) {
    await supabaseAdmin
      .from("pick_waves")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", waveId);
    return true;
  }

  await supabaseAdmin
    .from("pick_waves")
    .update({ status: "in_progress" })
    .eq("id", waveId)
    .eq("status", "open");

  return false;
}

async function maybeCompletePickTask(
  clientId: string,
  taskId: string,
  operatorId: string,
): Promise<{
  completed: boolean;
  orderExternalId?: string;
  waveId?: string;
  waveCompleted?: boolean;
}> {
  const { data: lines } = await supabaseAdmin
    .from("pick_task_lines")
    .select("status")
    .eq("task_id", taskId);

  const allTerminal = (lines ?? []).every((l) =>
    TERMINAL_LINE_STATUSES.includes(l.status as (typeof TERMINAL_LINE_STATUSES)[number]),
  );

  if (!allTerminal || !lines?.length) {
    return { completed: false };
  }

  const { data: task } = await supabaseAdmin
    .from("pick_tasks")
    .select("id, order_id, wave_id, status, orders(external_id)")
    .eq("id", taskId)
    .single();

  if (!task || task.status === "completed") {
    return { completed: false };
  }

  const hasIssue = (lines ?? []).some((l) => l.status === "not_found");
  const newStatus = hasIssue ? "issue" : "completed";

  await supabaseAdmin
    .from("pick_tasks")
    .update({
      status: newStatus,
      completed_at: new Date().toISOString(),
      operator_id: operatorId,
    })
    .eq("id", taskId);

  if (newStatus === "completed") {
    await supabaseAdmin
      .from("orders")
      .update({ status: "em_packing" })
      .eq("id", task.order_id);
  }

  await emitDomainEvent("picking.completed", {
    clientId,
    taskId,
    orderId: task.order_id,
    waveId: task.wave_id,
    hasIssue,
  });

  await logAudit({
    user_id: operatorId,
    client_id: clientId,
    action: "update",
    resource: "pick_task",
    resource_id: taskId,
    new_data: { status: newStatus },
  });

  const waveCompleted = await maybeCompleteWave(task.wave_id as string);

  return {
    completed: true,
    orderExternalId:
      (task.orders as { external_id: string } | null)?.external_id ??
      (task.order_id as string).slice(0, 8),
    waveId: task.wave_id as string,
    waveCompleted,
  };
}

export async function listPickWaves(clientId: string): Promise<PickWaveRow[]> {
  const { data: waves, error } = await supabaseAdmin
    .from("pick_waves")
    .select("id, status, created_at, completed_at, pick_tasks(id, status, pick_task_lines(status))")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  return (waves ?? []).map((w) => {
    const tasks = (w.pick_tasks as Array<{
      id: string;
      status: string;
      pick_task_lines: Array<{ status: string }>;
    }> | null) ?? [];

    let pendingLineCount = 0;
    for (const t of tasks) {
      pendingLineCount += (t.pick_task_lines ?? []).filter((l) => l.status === "pending").length;
    }

    return {
      id: w.id as string,
      status: w.status as string,
      createdAt: w.created_at as string,
      completedAt: (w.completed_at as string | null) ?? null,
      taskCount: tasks.length,
      completedTaskCount: tasks.filter((t) => t.status === "completed").length,
      pendingLineCount,
    };
  });
}

export async function generatePickWave(clientId: string): Promise<string | null> {
  const busyOrderIds = await getBusyOrderIds();

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "separacao")
    .eq("nf_status", "autorizada")
    .order("sla_deadline_at", { ascending: true, nullsFirst: false })
    .limit(50);

  const eligible = (orders ?? []).filter((o) => !busyOrderIds.has(o.id as string));
  if (!eligible.length) return null;

  const { data: wave, error: waveErr } = await supabaseAdmin
    .from("pick_waves")
    .insert({ client_id: clientId, status: "open", priority: 1 })
    .select("id")
    .single();

  if (waveErr) throw new Error(waveErr.message);

  const locations = await listWarehouseLocations(clientId);

  for (const order of eligible) {
    const orderId = order.id as string;

    await supabaseAdmin.from("orders").update({ status: "em_picking" }).eq("id", orderId);

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("id, sku, qty")
      .eq("order_id", orderId);

    const { data: task, error: taskErr } = await supabaseAdmin
      .from("pick_tasks")
      .insert({ wave_id: wave.id, order_id: orderId, status: "pending" })
      .select("id")
      .single();

    if (taskErr) throw new Error(taskErr.message);

    const linesWithLoc = await Promise.all(
      (items ?? []).map(async (item: { id: string; sku: string; qty: number }) => {
        const loc = (await getSkuLocationsFefo(clientId, item.sku, 1))[0];
        return {
          orderItemId: item.id,
          sku: item.sku,
          qty: item.qty,
          locationId: loc?.locationId ?? null,
        };
      }),
    );

    const route = optimizePickRoute(
      linesWithLoc.map((l) => ({ sku: l.sku, locationId: l.locationId })),
      locations,
    );

    for (let i = 0; i < linesWithLoc.length; i++) {
      const line = linesWithLoc[i];
      const routeLine = route[i];
      await supabaseAdmin.from("pick_task_lines").insert({
        task_id: task.id,
        order_item_id: line.orderItemId,
        location_id: line.locationId,
        sku: line.sku,
        qty_required: line.qty,
        sort_order: routeLine?.sortOrder ?? i,
      });
    }
  }

  await supabaseAdmin
    .from("pick_waves")
    .update({ status: "in_progress" })
    .eq("id", wave.id);

  return wave.id as string;
}

export async function confirmPickLine(
  clientId: string,
  taskLineId: string,
  barcode: string,
  operatorId: string,
): Promise<ConfirmPickResult> {
  const { data: line } = await supabaseAdmin
    .from("pick_task_lines")
    .select(
      "id, sku, qty_required, task_id, order_item_id, location_id, pick_tasks(order_id, orders(external_id))",
    )
    .eq("id", taskLineId)
    .single();

  if (!line) return { ok: false, error: "Linha não encontrada" };

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("barcode, sku")
    .eq("client_id", clientId)
    .eq("sku", line.sku)
    .maybeSingle();

  const expectedBarcode = product?.barcode ?? line.sku;
  if (barcode !== expectedBarcode && barcode !== line.sku) {
    return { ok: false, error: "Produto escaneado não corresponde ao pedido" };
  }

  await supabaseAdmin
    .from("pick_task_lines")
    .update({ qty_picked: line.qty_required, status: "picked" })
    .eq("id", taskLineId);

  await supabaseAdmin
    .from("order_items")
    .update({ picked_qty: line.qty_required })
    .eq("id", line.order_item_id);

  await decrementLocationStock(
    clientId,
    line.sku as string,
    (line.location_id as string | null) ?? null,
    line.qty_required as number,
  );

  await recordPickStockMovement(
    clientId,
    line.sku as string,
    line.qty_required as number,
    taskLineId,
    operatorId,
  );

  await supabaseAdmin
    .from("pick_tasks")
    .update({
      operator_id: operatorId,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("id", line.task_id);

  await recordFulfillmentUsage(clientId, "picks_completed");

  await logAudit({
    user_id: operatorId,
    client_id: clientId,
    action: "update",
    resource: "pick_task_line",
    resource_id: taskLineId,
    new_data: { status: "picked", sku: line.sku },
  });

  const completion = await maybeCompletePickTask(clientId, line.task_id as string, operatorId);
  const orderExternalId =
    (line.pick_tasks as { orders: { external_id: string } | null } | null)?.orders
      ?.external_id ?? undefined;

  return {
    ok: true,
    taskCompleted: completion.completed,
    orderExternalId: completion.orderExternalId ?? orderExternalId,
    waveCompleted: completion.waveCompleted ?? false,
  };
}

export async function markPickLineNotFound(
  clientId: string,
  taskLineId: string,
  operatorId: string,
): Promise<ConfirmPickResult> {
  const { data: line } = await supabaseAdmin
    .from("pick_task_lines")
    .select("id, sku, task_id, pick_tasks(order_id, orders(external_id))")
    .eq("id", taskLineId)
    .single();

  if (!line) return { ok: false, error: "Linha não encontrada" };

  await supabaseAdmin
    .from("pick_task_lines")
    .update({ status: "not_found", qty_picked: 0 })
    .eq("id", taskLineId);

  await supabaseAdmin.from("operation_alerts").insert({
    client_id: clientId,
    kind: "stock",
    severity: "warning",
    title: "Item não encontrado no picking",
    message: `SKU ${line.sku} não localizado na posição indicada`,
    is_resolved: false,
  });

  await supabaseAdmin
    .from("pick_tasks")
    .update({
      operator_id: operatorId,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("id", line.task_id);

  await logAudit({
    user_id: operatorId,
    client_id: clientId,
    action: "update",
    resource: "pick_task_line",
    resource_id: taskLineId,
    new_data: { status: "not_found", sku: line.sku },
  });

  const completion = await maybeCompletePickTask(clientId, line.task_id as string, operatorId);

  return {
    ok: true,
    taskCompleted: completion.completed,
    orderExternalId: completion.orderExternalId,
    waveCompleted: completion.waveCompleted ?? false,
  };
}

export async function completePickTask(
  clientId: string,
  taskId: string,
  operatorId: string,
): Promise<void> {
  const { data: task } = await supabaseAdmin
    .from("pick_tasks")
    .select("order_id, wave_id, status")
    .eq("id", taskId)
    .single();

  if (!task || task.status === "completed") return;

  await supabaseAdmin
    .from("pick_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      operator_id: operatorId,
    })
    .eq("id", taskId);

  await supabaseAdmin.from("orders").update({ status: "em_packing" }).eq("id", task.order_id);

  await emitDomainEvent("picking.completed", {
    clientId,
    taskId,
    orderId: task.order_id,
    waveId: task.wave_id,
    hasIssue: false,
  });

  await logAudit({
    user_id: operatorId,
    client_id: clientId,
    action: "update",
    resource: "pick_task",
    resource_id: taskId,
    new_data: { status: "completed" },
  });

  await maybeCompleteWave(task.wave_id as string);
}
