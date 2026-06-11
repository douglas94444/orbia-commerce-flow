import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { NormalizedOrderItem } from "./order-ingestion.server";

export async function upsertOrderItems(
  orderId: string,
  items: NormalizedOrderItem[],
  clientId: string,
): Promise<void> {
  await supabaseAdmin.from("order_items").delete().eq("order_id", orderId);

  for (const item of items) {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("client_id", clientId)
      .eq("sku", item.sku)
      .maybeSingle();

    await supabaseAdmin.from("order_items").insert({
      order_id: orderId,
      sku: item.sku,
      qty: item.quantity,
      unit_price_cents: item.unitPriceCents,
      product_id: product?.id ?? null,
    });
  }
}
