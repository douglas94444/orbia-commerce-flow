import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function enrichUpsellContext(
  clientId: string,
  customerId: string | null,
  trigger: string,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (trigger !== "pos_entrega_7d" || !customerId) return context;
  if (context.product_name && context.product_image) return context;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("metadata")
    .eq("client_id", clientId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) return context;

  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const items = (meta.items ?? []) as Array<Record<string, unknown>>;
  const purchasedSku = items[0]?.sku ? String(items[0].sku) : null;
  if (!purchasedSku) return context;

  const purchasedCategories = items
    .map((i) => String(i.category ?? i.product_type ?? ""))
    .filter(Boolean);

  let inventoryQuery = supabaseAdmin
    .from("inventory")
    .select("sku, product")
    .eq("client_id", clientId)
    .neq("sku", purchasedSku)
    .gt("units", 0)
    .order("units", { ascending: false })
    .limit(1);

  const { data: inventory } = await inventoryQuery.maybeSingle();
  if (!inventory) return context;

  const itemImage = items.find((i) => i.image)?.image;

  return {
    ...context,
    product_name: inventory.product ?? inventory.sku,
    product_image: itemImage ? String(itemImage) : context.product_image,
    product_sku: inventory.sku,
    upsell_from_sku: purchasedSku,
    upsell_categories: purchasedCategories,
  };
}
