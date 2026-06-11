import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSkuLocationsFefo, listWarehouseLocations } from "../wms/warehouse.server";
import { recordFulfillmentUsage } from "../forecast/volume-forecast.server";
import { optimizePickRoute } from "./route-optimizer.server";

export async function generatePickWave(clientId: string): Promise<string | null> {
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "separacao")
    .eq("nf_status", "autorizada")
    .order("sla_deadline_at", { ascending: true, nullsFirst: false })
    .limit(50);

  if (!orders?.length) return null;

  const { data: wave, error: waveErr } = await supabaseAdmin
    .from("pick_waves")
    .insert({ client_id: clientId, status: "open", priority: 1 })
    .select("id")
    .single();

  if (waveErr) throw new Error(waveErr.message);

  const locations = await listWarehouseLocations(clientId);

  for (const order of orders) {
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

  await recordFulfillmentUsage(clientId, "picks_completed");
  return wave.id as string;
}

export async function confirmPickLine(
  taskLineId: string,
  barcode: string,
  operatorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: line } = await supabaseAdmin
    .from("pick_task_lines")
    .select("id, sku, qty_required, task_id, pick_tasks(order_id)")
    .eq("id", taskLineId)
    .single();

  if (!line) return { ok: false, error: "Linha não encontrada" };

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("barcode, sku")
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

  const orderId = (line.pick_tasks as { order_id: string }).order_id;
  await supabaseAdmin
    .from("order_items")
    .update({ picked_qty: line.qty_required })
    .eq("order_id", orderId)
    .eq("sku", line.sku);

  await supabaseAdmin
    .from("pick_tasks")
    .update({ operator_id: operatorId, status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", line.task_id);

  return { ok: true };
}

export async function completePickTask(taskId: string): Promise<void> {
  const { data: task } = await supabaseAdmin
    .from("pick_tasks")
    .select("order_id")
    .eq("id", taskId)
    .single();

  if (!task) return;

  await supabaseAdmin
    .from("pick_tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);

  await supabaseAdmin.from("orders").update({ status: "em_packing" }).eq("id", task.order_id);
}
