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
  const { listStockAlertSkus } = await import("./warehouse.server");
  const alerts = await listStockAlertSkus(clientId);
  const critical = alerts.map((a) => a.sku);

  const since = new Date();
  since.setHours(since.getHours() - 24);

  for (const alert of alerts) {
    const { data: existing } = await supabaseAdmin
      .from("operation_alerts")
      .select("id")
      .eq("client_id", clientId)
      .eq("kind", "stock")
      .ilike("message", `%${alert.sku}%`)
      .gte("created_at", since.toISOString())
      .maybeSingle();

    if (existing) continue;

    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "stock",
      severity: alert.available === 0 ? "critical" : "warning",
      title: `Estoque crítico: ${alert.sku}`,
      message: `SKU ${alert.sku} com ${alert.available} un. (mínimo: ${alert.minStockUnits})`,
      is_resolved: false,
    });

    const { sendStockCriticalWhatsApp } = await import(
      "../notifications/whatsapp-alerts.server"
    );
    await sendStockCriticalWhatsApp(clientId, alert.sku, alert.available, alert.minStockUnits);
  }

  return critical;
}
