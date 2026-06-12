import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";

export interface WarehouseRow {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

export async function listWarehouses(clientId: string): Promise<WarehouseRow[]> {
  const { data, error } = await supabaseAdmin
    .from("warehouses")
    .select("id, name, code, is_default")
    .eq("client_id", clientId)
    .order("is_default", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((w) => ({
    id: w.id as string,
    name: w.name as string,
    code: w.code as string,
    isDefault: w.is_default as boolean,
  }));
}

export async function upsertWarehouse(
  clientId: string,
  input: { name: string; code: string; isDefault?: boolean },
  userId?: string,
): Promise<WarehouseRow> {
  if (input.isDefault) {
    await supabaseAdmin
      .from("warehouses")
      .update({ is_default: false })
      .eq("client_id", clientId);
  }

  const { data: existing } = await supabaseAdmin
    .from("warehouses")
    .select("id")
    .eq("client_id", clientId)
    .eq("code", input.code)
    .maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("warehouses")
      .update({
        name: input.name,
        is_default: input.isDefault ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, name, code, is_default")
      .single();
    if (error) throw new Error(error.message);
    row = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("warehouses")
      .insert({
        client_id: clientId,
        name: input.name,
        code: input.code,
        is_default: input.isDefault ?? false,
      })
      .select("id, name, code, is_default")
      .single();
    if (error) throw new Error(error.message);
    row = data;
  }

  if (userId) {
    await logAudit({
      user_id: userId,
      client_id: clientId,
      action: existing ? "update" : "create",
      resource: "warehouse",
      resource_id: row.id as string,
      new_data: input,
    });
  }

  return {
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
    isDefault: row.is_default as boolean,
  };
}

export async function ensureDefaultWarehouse(clientId: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("warehouses")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data, error } = await supabaseAdmin
    .from("warehouses")
    .insert({
      client_id: clientId,
      name: "Galpão principal",
      code: "MAIN",
      is_default: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}
