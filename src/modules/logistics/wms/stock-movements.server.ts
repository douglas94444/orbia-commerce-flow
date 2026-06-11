import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";

export interface StockMovementRow {
  id: string;
  sku: string;
  movement_type: string;
  qty: number;
  reason: string | null;
  created_at: string;
}

export async function adjustStock(
  clientId: string,
  sku: string,
  delta: number,
  reason: string,
  userId: string,
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("adjust_stock", {
    p_client_id: clientId,
    p_sku: sku,
    p_delta: delta,
    p_reason: reason,
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);

  await logAudit({
    user_id: userId,
    client_id: clientId,
    action: "update",
    resource: "inventory",
    resource_id: sku,
    new_data: { delta, reason },
  });

  return String(data);
}

export async function listStockMovements(
  clientId: string,
  sku?: string,
  limit = 100,
): Promise<StockMovementRow[]> {
  let query = supabaseAdmin
    .from("stock_movements")
    .select("id, sku, movement_type, qty, reason, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sku) query = query.eq("sku", sku);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as StockMovementRow[];
}

export async function checkMinStockAlerts(clientId: string): Promise<string[]> {
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("sku, min_stock_units")
    .eq("client_id", clientId)
    .gt("min_stock_units", 0);

  const { data: inventory } = await supabaseAdmin
    .from("inventory")
    .select("sku, units, reserved")
    .eq("client_id", clientId);

  const invMap = new Map(
    (inventory ?? []).map((i: { sku: string; units: number; reserved: number }) => [
      i.sku,
      i.units - (i.reserved ?? 0),
    ]),
  );

  const critical: string[] = [];
  for (const p of products ?? []) {
    const row = p as { sku: string; min_stock_units: number };
    const available = invMap.get(row.sku) ?? 0;
    if (available <= row.min_stock_units) critical.push(row.sku);
  }
  return critical;
}
