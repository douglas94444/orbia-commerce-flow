import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function recordStockMovement(
  clientId: string,
  sku: string,
  type: string,
  qty: number,
  referenceId: string,
  userId: string,
): Promise<void> {
  await supabaseAdmin.rpc("record_stock_movement", {
    p_client_id: clientId,
    p_sku: sku,
    p_movement_type: type,
    p_qty: qty,
    p_reference_type: "receiving",
    p_reference_id: referenceId,
    p_user_id: userId,
    p_reason: null,
  });
}
