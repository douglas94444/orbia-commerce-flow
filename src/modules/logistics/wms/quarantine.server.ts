import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";

export interface QuarantineItemRow {
  id: string;
  sku: string;
  qty: number;
  reason: string | null;
  status: string;
  createdAt: string;
}

export async function listQuarantineItems(clientId: string): Promise<QuarantineItemRow[]> {
  const { data, error } = await supabaseAdmin
    .from("quarantine_items")
    .select("id, sku, qty, reason, status, created_at")
    .eq("client_id", clientId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    sku: r.sku as string,
    qty: r.qty as number,
    reason: (r.reason as string | null) ?? null,
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}

export async function releaseQuarantineItem(
  clientId: string,
  itemId: string,
  userId: string,
): Promise<void> {
  const { data: item } = await supabaseAdmin
    .from("quarantine_items")
    .select("sku, qty")
    .eq("id", itemId)
    .eq("client_id", clientId)
    .single();

  if (!item) throw new Error("Item não encontrado");

  const { error } = await supabaseAdmin
    .from("quarantine_items")
    .update({ status: "released", resolved_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  const { data: inv } = await supabaseAdmin
    .from("inventory")
    .select("units")
    .eq("client_id", clientId)
    .eq("sku", item.sku)
    .maybeSingle();

  if (inv) {
    await supabaseAdmin
      .from("inventory")
      .update({ units: (inv.units as number) + (item.qty as number) })
      .eq("client_id", clientId)
      .eq("sku", item.sku);
  } else {
    await supabaseAdmin.from("inventory").insert({
      client_id: clientId,
      sku: item.sku,
      product: item.sku,
      units: item.qty,
    });
  }

  await logAudit({
    user_id: userId,
    client_id: clientId,
    action: "update",
    resource: "quarantine_item",
    resource_id: itemId,
    new_data: { action: "released", sku: item.sku },
  });
}

export async function discardQuarantineItem(
  clientId: string,
  itemId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("quarantine_items")
    .update({ status: "discarded", resolved_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);

  await logAudit({
    user_id: userId,
    client_id: clientId,
    action: "update",
    resource: "quarantine_item",
    resource_id: itemId,
    new_data: { action: "discarded" },
  });
}
