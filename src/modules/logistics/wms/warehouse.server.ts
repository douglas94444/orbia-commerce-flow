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
  ncm: string | null;
  photoUrl: string | null;
  parentProductId: string | null;
}

export interface UpsertWmsProductInput {
  sku: string;
  barcode?: string | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  ncm?: string | null;
  minStockUnits?: number;
  photoUrl?: string | null;
  parentProductId?: string | null;
}

export async function listWmsProducts(clientId: string): Promise<WmsProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      "id, sku, name, barcode, length_mm, width_mm, height_mm, min_stock_units, ncm, photo_url, parent_product_id",
    )
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
    ncm: r.ncm ? String(r.ncm) : null,
    photoUrl: r.photo_url ? String(r.photo_url) : null,
    parentProductId: r.parent_product_id ? String(r.parent_product_id) : null,
  }));
}

export async function upsertWmsProduct(
  clientId: string,
  input: UpsertWmsProductInput,
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("products")
    .select("id, name")
    .eq("client_id", clientId)
    .eq("sku", input.sku)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    client_id: clientId,
    sku: input.sku,
    name: existing?.name ?? input.sku,
    updated_at: new Date().toISOString(),
  };
  if (input.barcode !== undefined) patch.barcode = input.barcode;
  if (input.lengthMm !== undefined) patch.length_mm = input.lengthMm;
  if (input.widthMm !== undefined) patch.width_mm = input.widthMm;
  if (input.heightMm !== undefined) patch.height_mm = input.heightMm;
  if (input.ncm !== undefined) patch.ncm = input.ncm;
  if (input.minStockUnits !== undefined) patch.min_stock_units = input.minStockUnits;
  if (input.photoUrl !== undefined) patch.photo_url = input.photoUrl;
  if (input.parentProductId !== undefined) patch.parent_product_id = input.parentProductId;

  const { data, error } = await supabaseAdmin
    .from("products")
    .upsert(patch, { onConflict: "client_id,sku" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function uploadProductPhoto(
  clientId: string,
  sku: string,
  dataUrl: string,
): Promise<string> {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagem inválido");

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const path = `${clientId}/products/${sku}.${ext}`;

  const { error } = await supabaseAdmin.storage.from("fulfillment-evidence").upload(path, buffer, {
    contentType: `image/${match[1]}`,
    upsert: true,
  });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  const { data: urlData } = supabaseAdmin.storage.from("fulfillment-evidence").getPublicUrl(path);
  await upsertWmsProduct(clientId, { sku, photoUrl: urlData.publicUrl });
  return urlData.publicUrl;
}

export interface StockAlertSku {
  sku: string;
  available: number;
  minStockUnits: number;
}

export async function listStockAlertSkus(clientId: string): Promise<StockAlertSku[]> {
  const products = await listWmsProducts(clientId);
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

  return products
    .filter((p) => p.minStockUnits > 0)
    .map((p) => ({
      sku: p.sku,
      available: invMap.get(p.sku) ?? 0,
      minStockUnits: p.minStockUnits,
    }))
    .filter((p) => p.available <= p.minStockUnits);
}

export async function listProductVariations(
  clientId: string,
  parentProductId: string,
): Promise<WmsProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(
      "id, sku, name, barcode, length_mm, width_mm, height_mm, min_stock_units, ncm, photo_url, parent_product_id",
    )
    .eq("client_id", clientId)
    .eq("parent_product_id", parentProductId)
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
    ncm: r.ncm ? String(r.ncm) : null,
    photoUrl: r.photo_url ? String(r.photo_url) : null,
    parentProductId: r.parent_product_id ? String(r.parent_product_id) : null,
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

export async function deactivateWarehouseLocation(clientId: string, id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("warehouse_locations")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);
}

export interface LocationStockRow {
  id: string;
  sku: string;
  locationId: string;
  binCode: string;
  qty: number;
  reservedQty: number;
  lotCode: string | null;
  expiresAt: string | null;
}

export async function listLocationStock(
  clientId: string,
  locationId?: string,
): Promise<LocationStockRow[]> {
  let query = supabaseAdmin
    .from("inventory_locations")
    .select(
      "id, sku, location_id, qty, reserved_qty, product_lots(lot_code, expires_at), warehouse_locations(bin_code)",
    )
    .eq("client_id", clientId)
    .gt("qty", 0);

  if (locationId) query = query.eq("location_id", locationId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const loc = row.warehouse_locations as { bin_code: string } | null;
    const lot = row.product_lots as { lot_code: string; expires_at: string | null } | null;
    return {
      id: row.id as string,
      sku: row.sku as string,
      locationId: row.location_id as string,
      binCode: loc?.bin_code ?? "",
      qty: row.qty as number,
      reservedQty: (row.reserved_qty as number) ?? 0,
      lotCode: lot?.lot_code ?? null,
      expiresAt: lot?.expires_at ?? null,
    };
  });
}

export async function assignSkuToLocation(
  clientId: string,
  sku: string,
  locationId: string,
  qty: number,
  lotId?: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin.from("inventory_locations").upsert(
    {
      client_id: clientId,
      sku,
      location_id: locationId,
      qty,
      lot_id: lotId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,sku,location_id,lot_id" },
  );
  if (error) throw new Error(error.message);
}

export interface SkuLocationPick {
  locationId: string;
  binCode: string;
  qty: number;
  lotId: string | null;
  expiresAt: string | null;
}

/** FEFO: primeiro lote a vencer, depois rota do armazém. */
export async function getSkuLocation(
  clientId: string,
  sku: string,
): Promise<SkuLocationPick | null> {
  const picks = await getSkuLocationsFefo(clientId, sku, 1);
  return picks[0] ?? null;
}

export async function getSkuLocationsFefo(
  clientId: string,
  sku: string,
  limit = 5,
): Promise<SkuLocationPick[]> {
  const { data, error } = await supabaseAdmin
    .from("inventory_locations")
    .select(
      "location_id, qty, reserved_qty, lot_id, product_lots(expires_at), warehouse_locations(bin_code, route_order)",
    )
    .eq("client_id", clientId)
    .eq("sku", sku)
    .gt("qty", 0);

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  const rows = data
    .map((row) => {
      const loc = row.warehouse_locations as { bin_code: string; route_order: number } | null;
      const lot = row.product_lots as { expires_at: string | null } | null;
      const available = (row.qty as number) - ((row.reserved_qty as number) ?? 0);
      return {
        locationId: row.location_id as string,
        binCode: loc?.bin_code ?? "",
        qty: available,
        lotId: (row.lot_id as string | null) ?? null,
        expiresAt: lot?.expires_at ?? null,
        routeOrder: loc?.route_order ?? 9999,
      };
    })
    .filter((r) => r.qty > 0)
    .sort((a, b) => {
      if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
      if (a.expiresAt) return -1;
      if (b.expiresAt) return 1;
      return a.routeOrder - b.routeOrder;
    });

  return rows.slice(0, limit).map(({ routeOrder: _, ...rest }) => rest);
}
