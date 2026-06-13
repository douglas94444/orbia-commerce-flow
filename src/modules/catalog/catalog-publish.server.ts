import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { pushMercadoLivreStock } from "@/integrations/mercado-livre/catalog";
import { pushNuvemshopStock } from "@/integrations/nuvemshop/catalog";
import { pushShopeeStock } from "@/integrations/shopee/catalog";
import { pushShopifyStock } from "@/integrations/shopify/catalog";
import { pushAmazonStock } from "@/integrations/amazon/catalog";
import { pushTikTokStock } from "@/integrations/tiktok/catalog";
import { logAudit } from "@/shared/lib/logger";
import { computeChannelPrice } from "./pricing-engine.server";
import { getBufferedStockForChannel } from "./stock-buffer.server";
import type { CatalogChannel } from "./sync-catalog.server";

export async function publishSkuToChannel(
  clientId: string,
  channel: CatalogChannel,
  sku: string,
): Promise<{ priceCents: number; stockQty: number } | null> {
  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select("auto_emit_nfe")
    .eq("client_id", clientId)
    .maybeSingle();

  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, price_cents, ncm")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .maybeSingle();

  if (fiscal?.auto_emit_nfe && !product?.ncm?.trim()) {
    throw new Error(
      `SKU ${sku} sem NCM — publicação bloqueada enquanto auto_emit_nfe estiver ativo. Configure em /catalog/fiscal`,
    );
  }

  if (!product?.price_cents) return null;

  const { data: listing } = await supabaseAdmin
    .from("channel_listings")
    .select("external_product_id, external_variant_id, metadata")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .eq("product_id", product.id)
    .maybeSingle();

  if (!listing) return null;

  const { data: inv } = await supabaseAdmin
    .from("inventory")
    .select("units, reserved")
    .eq("client_id", clientId)
    .eq("sku", sku)
    .maybeSingle();

  const available = Math.max(0, (inv?.units ?? 0) - (inv?.reserved ?? 0));
  const stockQty = await getBufferedStockForChannel(clientId, channel, available);
  const priceCents = await computeChannelPrice(clientId, channel, product.price_cents);

  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", clientId)
    .eq("provider", channel)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return null;

  const accessToken = decryptToken(conn.access_token);
  const meta = (listing.metadata ?? {}) as Record<string, unknown>;
  const connMeta = (conn.metadata ?? {}) as Record<string, unknown>;

  switch (channel) {
    case "nuvemshop":
      await pushNuvemshopStock(
        conn.external_account ?? "",
        accessToken,
        listing.external_product_id,
        listing.external_variant_id ?? listing.external_product_id,
        stockQty,
      );
      break;
    case "shopify": {
      const shop = String(connMeta.shop ?? conn.external_account);
      const locationId = String(meta.location_id ?? connMeta.location_id ?? "");
      const inventoryItemId = String(meta.inventory_item_id ?? listing.external_variant_id ?? "");
      if (locationId && inventoryItemId) {
        await pushShopifyStock(shop, accessToken, inventoryItemId, locationId, stockQty);
      }
      break;
    }
    case "mercado_livre":
      await pushMercadoLivreStock(listing.external_product_id, accessToken, stockQty);
      break;
    case "shopee":
      await pushShopeeStock(
        conn.external_account ?? "",
        accessToken,
        listing.external_product_id,
        listing.external_variant_id ?? listing.external_product_id,
        stockQty,
      );
      break;
    case "amazon":
      await pushAmazonStock(
        clientId,
        listing.external_product_id,
        sku,
        stockQty,
        accessToken,
      );
      break;
    case "tiktok":
      await pushTikTokStock(
        clientId,
        listing.external_product_id,
        listing.external_variant_id ?? listing.external_product_id,
        stockQty,
        accessToken,
        conn.external_account ?? "",
      );
      break;
  }

  await supabaseAdmin
    .from("channel_listings")
    .update({
      channel_price_cents: priceCents,
      metadata: { ...meta, stock_qty: stockQty, published_price_cents: priceCents },
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("channel", channel)
    .eq("product_id", product.id);

  await logAudit({
    user_id: "system",
    client_id: clientId,
    action: "update",
    resource: "channel_listing",
    resource_id: listing.external_product_id,
    new_data: { sku, channel, priceCents, stockQty },
  });

  return { priceCents, stockQty };
}

export async function publishSkuToAllChannels(
  clientId: string,
  sku: string,
): Promise<Record<string, { priceCents: number; stockQty: number } | null>> {
  const channels: CatalogChannel[] = [
    "nuvemshop",
    "shopify",
    "mercado_livre",
    "shopee",
    "amazon",
    "tiktok",
  ];

  const result: Record<string, { priceCents: number; stockQty: number } | null> = {};

  for (const channel of channels) {
    try {
      result[channel] = await publishSkuToChannel(clientId, channel, sku);
    } catch (err) {
      console.warn(`[catalog-publish] ${channel} ${sku}:`, err);
      result[channel] = null;
    }
  }

  return result;
}
