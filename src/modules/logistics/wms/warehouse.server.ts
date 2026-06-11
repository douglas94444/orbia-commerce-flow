import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface WarehouseLocation {
  id: string;
  aisle: string;
  shelf: string;
  level: string;
  binCode: string;
  routeOrder: number;
}

export async function listWarehouseLocations(clientId: string): Promise<WarehouseLocation[]> {
  const { data, error } = await supabaseAdmin
    .from("warehouse_locations")
    .select("id, aisle, shelf, level, bin_code, route_order")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("route_order");

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    aisle: String(r.aisle),
    shelf: String(r.shelf),
    level: String(r.level),
    binCode: String(r.bin_code),
    routeOrder: Number(r.route_order),
  }));
}

export interface WmsProduct {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  minStockUnits: number;
}

export async function listWmsProducts(clientId: string): Promise<WmsProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, sku, name, barcode, length_mm, width_mm, height_mm, min_stock_units")
    .eq("client_id", clientId)
    .order("sku");

  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    sku: String(r.sku),
    name: String(r.name),
    barcode: r.barcode ? String(r.barcode) : null,
    lengthMm: r.length_mm != null ? Number(r.length_mm) : null,
    widthMm: r.width_mm != null ? Number(r.width_mm) : null,
    heightMm: r.height_mm != null ? Number(r.height_mm) : null,
    minStockUnits: Number(r.min_stock_units ?? 0),
  }));
}

export async function upsertWarehouseLocation(
  clientId: string,
  input: Omit<WarehouseLocation, "id"> & { id?: string },
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("warehouse_locations")
    .upsert(
      {
        id: input.id,
        client_id: clientId,
        aisle: input.aisle,
        shelf: input.shelf,
        level: input.level,
        bin_code: input.binCode,
        route_order: input.routeOrder,
      },
      { onConflict: "client_id,bin_code" },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getSkuLocation(
  clientId: string,
  sku: string,
): Promise<{ locationId: string; binCode: string; qty: number } | null> {
  const { data } = await supabaseAdmin
    .from("inventory_locations")
    .select("location_id, qty, warehouse_locations(bin_code)")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .gt("qty", 0)
    .order("qty", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const loc = data.warehouse_locations as { bin_code: string } | null;
  return {
    locationId: data.location_id as string,
    binCode: loc?.bin_code ?? "",
    qty: data.qty as number,
  };
}
