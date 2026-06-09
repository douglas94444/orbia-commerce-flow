import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pushMercadoLivreStock } from "@/integrations/mercado-livre/catalog";
import { pushNuvemshopStock } from "@/integrations/nuvemshop/catalog";
import { pushShopeeStock } from "@/integrations/shopee/catalog";
import { pushShopifyStock } from "@/integrations/shopify/catalog";
import type { CatalogChannel } from "./sync-catalog.server";

export async function pushStockToChannel(
  clientId: string,
  channel: CatalogChannel,
  sku: string,
  qty: number,
): Promise<void> {
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .maybeSingle();

  if (!product) return;

  const { data: listing } = await supabaseAdmin
    .from("channel_listings")
    .select("external_product_id, external_variant_id, metadata")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .eq("product_id", product.id)
    .maybeSingle();

  if (!listing) return;

  const conn = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", clientId)
    .eq("provider", channel)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.data?.access_token) return;

  const accessToken = conn.data.access_token;
  const meta = (listing.metadata ?? {}) as Record<string, unknown>;
  const connMeta = (conn.data.metadata ?? {}) as Record<string, unknown>;

  try {
    switch (channel) {
      case "nuvemshop":
        await pushNuvemshopStock(
          conn.data.external_account ?? "",
          accessToken,
          listing.external_product_id,
          listing.external_variant_id ?? listing.external_product_id,
          qty,
        );
        break;
      case "shopify": {
        const shop = String(connMeta.shop ?? conn.data.external_account);
        const locationId = String(meta.location_id ?? connMeta.location_id ?? "");
        const inventoryItemId = String(meta.inventory_item_id ?? listing.external_variant_id ?? "");
        if (locationId && inventoryItemId) {
          await pushShopifyStock(shop, accessToken, inventoryItemId, locationId, qty);
        }
        break;
      }
      case "mercado_livre":
        await pushMercadoLivreStock(listing.external_product_id, accessToken, qty);
        break;
      case "shopee":
        await pushShopeeStock(
          conn.data.external_account ?? "",
          accessToken,
          listing.external_product_id,
          listing.external_variant_id ?? listing.external_product_id,
          qty,
        );
        break;
    }
  } catch (err) {
    console.warn(`[catalog-push] ${channel} ${sku}:`, err);
  }
}

export async function pushStockToAllChannels(
  clientId: string,
  sku: string,
): Promise<void> {
  const { data: inv } = await supabaseAdmin
    .from("inventory")
    .select("units, reserved")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .maybeSingle();

  if (!inv) return;
  const available = Math.max(0, inv.units - inv.reserved);

  const channels: CatalogChannel[] = ["nuvemshop", "shopify", "mercado_livre", "shopee"];
  await Promise.all(channels.map((ch) => pushStockToChannel(clientId, ch, sku, available)));
}
