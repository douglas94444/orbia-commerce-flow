import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { pushMercadoLivreStock } from "@/integrations/mercado-livre/catalog";
import { pushNuvemshopStock } from "@/integrations/nuvemshop/catalog";
import { pushShopeeStock } from "@/integrations/shopee/catalog";
import { pushShopifyStock } from "@/integrations/shopify/catalog";
import { pushAmazonStock } from "@/integrations/amazon/catalog";
import { pushTikTokStock } from "@/integrations/tiktok/catalog";
import { getBufferedStockForChannel, getChannelStockBuffer } from "./stock-buffer.server";
import type { CatalogChannel } from "./sync-catalog.server";

async function pauseListingIfBlackout(
  clientId: string,
  channel: CatalogChannel,
  productId: string,
  effectiveQty: number,
): Promise<void> {
  const buffer = await getChannelStockBuffer(clientId, channel);
  if (effectiveQty > 0 || !buffer.blackoutWhenZero) return;

  await supabaseAdmin
    .from("channel_listings")
    .update({
      listing_status: "paused",
      metadata: { blackout: true, paused_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("channel", channel)
    .eq("product_id", productId);
}

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

  const effectiveQty = await getBufferedStockForChannel(clientId, channel, qty);
  await pauseListingIfBlackout(clientId, channel, product.id, effectiveQty);

  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", clientId)
    .eq("provider", channel)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return;

  const accessToken = decryptToken(conn.access_token);
  const meta = (listing.metadata ?? {}) as Record<string, unknown>;
  const connMeta = (conn.metadata ?? {}) as Record<string, unknown>;

  try {
    switch (channel) {
      case "nuvemshop":
        await pushNuvemshopStock(
          conn.external_account ?? "",
          accessToken,
          listing.external_product_id,
          listing.external_variant_id ?? listing.external_product_id,
          effectiveQty,
        );
        break;
      case "shopify": {
        const shop = String(connMeta.shop ?? conn.external_account);
        const locationId = String(meta.location_id ?? connMeta.location_id ?? "");
        const inventoryItemId = String(meta.inventory_item_id ?? listing.external_variant_id ?? "");
        if (locationId && inventoryItemId) {
          await pushShopifyStock(shop, accessToken, inventoryItemId, locationId, effectiveQty);
        }
        break;
      }
      case "mercado_livre":
        await pushMercadoLivreStock(listing.external_product_id, accessToken, effectiveQty);
        break;
      case "shopee":
        await pushShopeeStock(
          conn.external_account ?? "",
          accessToken,
          listing.external_product_id,
          listing.external_variant_id ?? listing.external_product_id,
          effectiveQty,
        );
        break;
      case "amazon":
        await pushAmazonStock(
          clientId,
          listing.external_product_id,
          sku,
          effectiveQty,
          accessToken,
        );
        break;
      case "tiktok":
        await pushTikTokStock(
          clientId,
          listing.external_product_id,
          listing.external_variant_id ?? listing.external_product_id,
          effectiveQty,
          accessToken,
          conn.external_account ?? "",
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

  const channels: CatalogChannel[] = [
    "nuvemshop",
    "shopify",
    "mercado_livre",
    "shopee",
    "amazon",
    "tiktok",
  ];
  await Promise.all(channels.map((ch) => pushStockToChannel(clientId, ch, sku, available)));
}

/** Propaga estoque do SKU pai para variações no push. */
export async function pushStockWithVariations(clientId: string, sku: string): Promise<void> {
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, parent_product_id")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .maybeSingle();

  await pushStockToAllChannels(clientId, sku);

  if (product?.parent_product_id) {
    const { data: siblings } = await supabaseAdmin
      .from("products")
      .select("sku")
      .eq("client_id", clientId)
      .eq("parent_product_id", product.parent_product_id);

    for (const s of siblings ?? []) {
      if ((s.sku as string) !== sku) {
        await pushStockToAllChannels(clientId, s.sku as string);
      }
    }
  }

  const { data: children } = await supabaseAdmin
    .from("products")
    .select("sku")
    .eq("client_id", clientId)
    .eq("parent_product_id", product?.id ?? "");

  for (const child of children ?? []) {
    await pushStockToAllChannels(clientId, child.sku as string);
  }
}
