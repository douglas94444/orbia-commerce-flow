import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function recordPickStockMovement(
  clientId: string,
  sku: string,
  qty: number,
  taskLineId: string,
  userId: string,
): Promise<void> {
  await supabaseAdmin.rpc("record_stock_movement", {
    p_client_id: clientId,
    p_sku: sku,
    p_movement_type: "saida",
    p_qty: qty,
    p_reference_type: "pick",
    p_reference_id: taskLineId,
    p_user_id: userId,
    p_reason: "Picking WMS",
  });
}

export async function decrementLocationStock(
  clientId: string,
  sku: string,
  locationId: string | null,
  qty: number,
): Promise<void> {
  if (!locationId || qty <= 0) return;

  const { data: rows } = await supabaseAdmin
    .from("inventory_locations")
    .select("id, qty")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .eq("location_id", locationId)
    .order("qty", { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return;

  const newQty = Math.max(0, (row.qty as number) - qty);
  await supabaseAdmin.from("inventory_locations").update({ qty: newQty }).eq("id", row.id);
}
