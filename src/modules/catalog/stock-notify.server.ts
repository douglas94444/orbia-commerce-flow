import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";

export async function upsertInventoryWithBackInStockNotify(
  clientId: string,
  sku: string,
  productName: string,
  newUnits: number,
): Promise<void> {
  const { data: prev } = await supabaseAdmin
    .from("inventory")
    .select("units")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .maybeSingle();

  const prevUnits = prev?.units ?? 0;

  await supabaseAdmin.from("inventory").upsert(
    {
      client_id: clientId,
      sku,
      product: productName,
      units: newUnits,
      reserved: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,sku" },
  );

  if (prevUnits <= 0 && newUnits > 0) {
    await emitDomainEvent("product.back_in_stock", {
      clientId,
      sku,
      units: newUnits,
      productName,
    });
  }

  await emitDomainEvent("inventory.updated", { clientId, sku, units: newUnits });
}
