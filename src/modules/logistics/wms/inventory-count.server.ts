import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adjustStock } from "./stock-movements.server";

export interface InventoryCountRow {
  id: string;
  countType: "rotativo" | "geral";
  status: string;
  startedAt: string;
  completedAt: string | null;
  lineCount: number;
  divergenceCount: number;
}

export interface StartInventoryCountOptions {
  skus?: string[];
  aisle?: string;
  locationId?: string;
}

export async function startInventoryCount(
  clientId: string,
  countType: "rotativo" | "geral",
  startedBy: string,
  options: StartInventoryCountOptions = {},
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("inventory_counts")
    .insert({
      client_id: clientId,
      count_type: countType,
      status: "open",
      started_by: startedBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  let skusToCount: Array<{ sku: string; units: number; locationId?: string }> = [];

  if (options.locationId || options.aisle) {
    let locQuery = supabaseAdmin
      .from("inventory_locations")
      .select("sku, qty, location_id, warehouse_locations(aisle)")
      .eq("client_id", clientId)
      .gt("qty", 0);

    if (options.locationId) locQuery = locQuery.eq("location_id", options.locationId);

    const { data: locRows } = await locQuery;
    skusToCount = (locRows ?? [])
      .filter((row) => {
        if (!options.aisle) return true;
        const aisle = (row.warehouse_locations as { aisle: string } | null)?.aisle;
        return aisle === options.aisle;
      })
      .map((row) => ({
        sku: row.sku as string,
        units: row.qty as number,
        locationId: row.location_id as string,
      }));
  } else {
    const { data: inventory } = await supabaseAdmin
      .from("inventory")
      .select("sku, units")
      .eq("client_id", clientId);

    skusToCount = (inventory ?? []).map((row: { sku: string; units: number }) => ({
      sku: row.sku,
      units: row.units as number,
    }));
  }

  if (countType === "rotativo" && options.skus?.length) {
    const set = new Set(options.skus);
    skusToCount = skusToCount.filter((r) => set.has(r.sku));
  } else if (countType === "rotativo" && !options.skus?.length && !options.aisle && !options.locationId) {
    skusToCount = skusToCount.slice(0, Math.max(10, Math.ceil(skusToCount.length / 4)));
  }

  const lines = skusToCount.map((row) => ({
    count_id: data.id,
    sku: row.sku,
    system_qty: row.units,
    location_id: row.locationId ?? null,
  }));

  if (lines.length) {
    const { error: lineErr } = await supabaseAdmin.from("inventory_count_lines").insert(lines);
    if (lineErr) throw new Error(lineErr.message);
  }

  return data.id as string;
}

export async function recordCountLine(
  countId: string,
  sku: string,
  countedQty: number,
  locationId?: string,
): Promise<void> {
  let query = supabaseAdmin
    .from("inventory_count_lines")
    .update({ counted_qty: countedQty })
    .eq("count_id", countId)
    .eq("sku", sku);

  if (locationId) query = query.eq("location_id", locationId);

  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function exportCountReport(countId: string): Promise<string> {
  const lines = await getInventoryCountLines(countId);
  const header = "sku,system_qty,counted_qty,divergence\n";
  const rows = lines
    .map(
      (l: { sku: string; system_qty: number; counted_qty: number | null; divergence: number | null }) =>
        `${l.sku},${l.system_qty},${l.counted_qty ?? ""},${l.divergence ?? ""}`,
    )
    .join("\n");
  return header + rows;
}

export async function completeInventoryCount(
  clientId: string,
  countId: string,
  userId: string,
): Promise<{ adjusted: number }> {
  const { data: lines } = await supabaseAdmin
    .from("inventory_count_lines")
    .select("sku, divergence")
    .eq("count_id", countId)
    .not("counted_qty", "is", null);

  let adjusted = 0;
  for (const line of lines ?? []) {
    const divergence = line.divergence as number;
    if (divergence === 0) continue;
    await adjustStock(
      clientId,
      line.sku as string,
      divergence,
      `Inventário ${countId.slice(0, 8)}`,
      userId,
    );
    adjusted += 1;
  }

  await supabaseAdmin
    .from("inventory_counts")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", countId);

  return { adjusted };
}

export async function listInventoryCounts(clientId: string): Promise<InventoryCountRow[]> {
  const { data, error } = await supabaseAdmin
    .from("inventory_counts")
    .select("id, count_type, status, started_at, completed_at, inventory_count_lines(divergence, counted_qty)")
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const lineRows = (row.inventory_count_lines ?? []) as Array<{
      divergence: number;
      counted_qty: number | null;
    }>;
    return {
      id: row.id as string,
      countType: row.count_type as "rotativo" | "geral",
      status: row.status as string,
      startedAt: row.started_at as string,
      completedAt: (row.completed_at as string | null) ?? null,
      lineCount: lineRows.length,
      divergenceCount: lineRows.filter((l) => l.counted_qty != null && l.divergence !== 0).length,
    };
  });
}

export async function getInventoryCountLines(countId: string) {
  const { data, error } = await supabaseAdmin
    .from("inventory_count_lines")
    .select("id, sku, system_qty, counted_qty, divergence")
    .eq("count_id", countId)
    .order("sku");

  if (error) throw new Error(error.message);
  return data ?? [];
}
