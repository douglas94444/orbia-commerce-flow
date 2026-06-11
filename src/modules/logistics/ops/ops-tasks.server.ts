import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface OpsPickLine {
  lineId: string;
  taskId: string;
  orderId: string;
  orderExternalId: string;
  sku: string;
  qtyRequired: number;
  qtyPicked: number;
  status: string;
  sortOrder: number;
  slaDeadlineAt: string | null;
  locationLabel: string | null;
}

export async function getOpsPickQueue(clientId: string): Promise<OpsPickLine[]> {
  const { data: waves } = await supabaseAdmin
    .from("pick_waves")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["open", "in_progress"]);

  const waveIds = (waves ?? []).map((w: { id: string }) => w.id);
  if (!waveIds.length) return [];

  const { data: tasks } = await supabaseAdmin
    .from("pick_tasks")
    .select("id, order_id, orders(external_id, sla_deadline_at)")
    .in("wave_id", waveIds)
    .in("status", ["pending", "in_progress"]);

  const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
  if (!taskIds.length) return [];

  const { data: lines } = await supabaseAdmin
    .from("pick_task_lines")
    .select(
      "id, task_id, sku, qty_required, qty_picked, status, sort_order, warehouse_locations(aisle, shelf, level, bin_code)",
    )
    .in("task_id", taskIds)
    .in("status", ["pending"])
    .order("sort_order");

  const taskById = new Map(
    (tasks ?? []).map((t: { id: string; order_id: string; orders: unknown }) => [
      t.id,
      t,
    ]),
  );

  const queue: OpsPickLine[] = [];
  for (const line of lines ?? []) {
    const task = taskById.get(line.task_id as string) as
      | {
          id: string;
          order_id: string;
          orders: { external_id: string; sla_deadline_at: string | null } | null;
        }
      | undefined;
    if (!task) continue;

    const loc = line.warehouse_locations as {
      aisle: string;
      shelf: string;
      level: string;
      bin_code: string;
    } | null;

    queue.push({
      lineId: line.id as string,
      taskId: line.task_id as string,
      orderId: task.order_id,
      orderExternalId: task.orders?.external_id ?? task.order_id.slice(0, 8),
      sku: line.sku as string,
      qtyRequired: line.qty_required as number,
      qtyPicked: line.qty_picked as number,
      status: line.status as string,
      sortOrder: line.sort_order as number,
      slaDeadlineAt: task.orders?.sla_deadline_at ?? null,
      locationLabel: loc ? `${loc.aisle}-${loc.shelf}-${loc.level} (${loc.bin_code})` : null,
    });
  }

  queue.sort((a, b) => {
    const slaA = a.slaDeadlineAt ? new Date(a.slaDeadlineAt).getTime() : Number.MAX_SAFE_INTEGER;
    const slaB = b.slaDeadlineAt ? new Date(b.slaDeadlineAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (slaA !== slaB) return slaA - slaB;
    return a.sortOrder - b.sortOrder;
  });

  return queue;
}

export interface OpsPickOrderProgress {
  taskId: string;
  orderId: string;
  orderExternalId: string;
  pickedCount: number;
  totalCount: number;
  slaDeadlineAt: string | null;
}

export async function getOpsPickOrderProgress(clientId: string): Promise<OpsPickOrderProgress[]> {
  const { data: waves } = await supabaseAdmin
    .from("pick_waves")
    .select("id")
    .eq("client_id", clientId)
    .in("status", ["open", "in_progress"]);

  const waveIds = (waves ?? []).map((w: { id: string }) => w.id);
  if (!waveIds.length) return [];

  const { data: tasks } = await supabaseAdmin
    .from("pick_tasks")
    .select("id, order_id, orders(external_id, sla_deadline_at), pick_task_lines(status)")
    .in("wave_id", waveIds)
    .in("status", ["pending", "in_progress"]);

  return (tasks ?? []).map((t) => {
    const lines = (t.pick_task_lines as Array<{ status: string }> | null) ?? [];
    const pickedCount = lines.filter((l) =>
      ["picked", "not_found", "skipped"].includes(l.status),
    ).length;
    const orders = t.orders as { external_id: string; sla_deadline_at: string | null } | null;
    return {
      taskId: t.id as string,
      orderId: t.order_id as string,
      orderExternalId: orders?.external_id ?? (t.order_id as string).slice(0, 8),
      pickedCount,
      totalCount: lines.length,
      slaDeadlineAt: orders?.sla_deadline_at ?? null,
    };
  });
}
