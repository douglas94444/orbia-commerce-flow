import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ProductLotRow {
  id: string;
  sku: string;
  lotCode: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
}

export async function upsertProductLot(
  clientId: string,
  input: { sku: string; lotCode: string; expiresAt?: string | null; manufacturedAt?: string | null },
): Promise<string> {
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("client_id", clientId)
    .eq("sku", input.sku)
    .maybeSingle();

  if (!product) throw new Error(`Produto ${input.sku} não encontrado`);

  const { data, error } = await supabaseAdmin
    .from("product_lots")
    .upsert(
      {
        client_id: clientId,
        product_id: product.id,
        lot_code: input.lotCode,
        expires_at: input.expiresAt ?? null,
      },
      { onConflict: "client_id,product_id,lot_code" },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function listProductLots(clientId: string): Promise<ProductLotRow[]> {
  const { data, error } = await supabaseAdmin
    .from("product_lots")
    .select("id, lot_code, expires_at, products(sku)")
    .eq("client_id", clientId)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).map((row) => {
    const sku = (row.products as { sku: string } | null)?.sku ?? "";
    const expiresAt = row.expires_at as string | null;
    const daysUntilExpiry = expiresAt
      ? Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000)
      : null;
    return {
      id: row.id as string,
      sku,
      lotCode: row.lot_code as string,
      expiresAt,
      daysUntilExpiry,
    };
  });
}

export async function deleteProductLot(clientId: string, lotId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("product_lots")
    .delete()
    .eq("id", lotId)
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);
}

export async function listExpiringLots(clientId: string, withinDays = 30): Promise<ProductLotRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  const { data, error } = await supabaseAdmin
    .from("product_lots")
    .select("id, lot_code, expires_at, products(sku)")
    .eq("client_id", clientId)
    .not("expires_at", "is", null)
    .lte("expires_at", cutoff.toISOString())
    .order("expires_at");

  if (error) throw new Error(error.message);

  const now = Date.now();
  return (data ?? []).map((row) => {
    const sku = (row.products as { sku: string } | null)?.sku ?? "";
    const expiresAt = row.expires_at as string;
    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000);
    return {
      id: row.id as string,
      sku,
      lotCode: row.lot_code as string,
      expiresAt,
      daysUntilExpiry,
    };
  });
}
