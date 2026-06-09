import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MarketplaceChannel, NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

export async function resolveOrderItemsSkus(
  clientId: string,
  channel: MarketplaceChannel,
  items: NormalizedOrderItem[],
): Promise<NormalizedOrderItem[]> {
  const resolved: NormalizedOrderItem[] = [];

  for (const item of items) {
    const externalVariantId = item.externalVariantId ?? item.sku;
    const externalProductId = item.externalProductId ?? externalVariantId;

    const { data: byVariant } = await supabaseAdmin
      .from("channel_listings")
      .select("products(sku, name, ncm)")
      .eq("client_id", clientId)
      .eq("channel", channel)
      .eq("external_variant_id", externalVariantId)
      .maybeSingle();

    const { data: byProduct } = byVariant
      ? { data: null }
      : await supabaseAdmin
          .from("channel_listings")
          .select("products(sku, name, ncm)")
          .eq("client_id", clientId)
          .eq("channel", channel)
          .eq("external_product_id", externalProductId)
          .maybeSingle();

    const listing = byVariant ?? byProduct;
    const product = listing?.products as { sku: string; name: string; ncm: string | null } | null;

    if (product) {
      resolved.push({
        ...item,
        sku: product.sku,
        name: product.name,
        ncm: product.ncm ?? item.ncm,
      });
    } else {
      resolved.push(item);
    }
  }

  return resolved;
}
