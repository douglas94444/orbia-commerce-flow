import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { pullAmazonProducts } from "@/integrations/amazon/catalog";
import { pullMercadoLivreProducts } from "@/integrations/mercado-livre/catalog";
import { pullNuvemshopProducts } from "@/integrations/nuvemshop/catalog";
import { pullShopeeProducts } from "@/integrations/shopee/catalog";
import { pullShopifyProducts } from "@/integrations/shopify/catalog";
import { pullTikTokProducts } from "@/integrations/tiktok/catalog";
import type { CatalogProductRow } from "@/integrations/shopify/catalog";

export type CatalogChannel =
  | "nuvemshop"
  | "shopify"
  | "mercado_livre"
  | "shopee"
  | "amazon"
  | "tiktok";

const CHANNELS: CatalogChannel[] = [
  "nuvemshop",
  "shopify",
  "mercado_livre",
  "shopee",
  "amazon",
  "tiktok",
];

async function getOAuthConnection(clientId: string, provider: CatalogChannel) {
  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();
  if (data?.access_token) data.access_token = decryptToken(data.access_token);
  return data;
}

async function upsertCatalogRows(
  clientId: string,
  channel: CatalogChannel,
  rows: CatalogProductRow[],
): Promise<{ products: number; listings: number }> {
  let products = 0;
  let listings = 0;

  for (const row of rows) {
    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("ncm")
      .eq("client_id", clientId)
      .eq("sku", row.sku)
      .maybeSingle();

    const channelNcm = row.ncm?.replace(/\D/g, "");
    const shouldFillNcm =
      channelNcm && channelNcm.length === 8 && !existing?.ncm;

    const { data: product } = await supabaseAdmin
      .from("products")
      .upsert(
        {
          client_id: clientId,
          sku: row.sku,
          name: row.name,
          price_cents: row.priceCents,
          is_active: true,
          ...(shouldFillNcm ? { ncm: channelNcm } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,sku" },
      )
      .select("id")
      .single();

    if (!product) continue;
    products += 1;

    const { data: existingListing } = await supabaseAdmin
      .from("channel_listings")
      .select("metadata")
      .eq("client_id", clientId)
      .eq("channel", channel)
      .eq("external_product_id", row.externalProductId)
      .eq("external_variant_id", row.externalVariantId)
      .maybeSingle();

    const prevMeta = (existingListing?.metadata ?? {}) as Record<string, unknown>;
    const metadata: Record<string, unknown> = {
      ...prevMeta,
      stock_qty: row.stockQty,
      ...(row.listingMetadata ?? {}),
    };

    await supabaseAdmin.from("channel_listings").upsert(
      {
        client_id: clientId,
        product_id: product.id,
        channel,
        external_product_id: row.externalProductId,
        external_variant_id: row.externalVariantId,
        listing_status: "active",
        last_synced_at: new Date().toISOString(),
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,channel,external_product_id,external_variant_id" },
    );
    listings += 1;

    const { upsertInventoryWithBackInStockNotify } = await import("./stock-notify.server");
    await upsertInventoryWithBackInStockNotify(clientId, row.sku, row.name, row.stockQty);
  }

  return { products, listings };
}

export async function pullProductsFromChannel(
  clientId: string,
  channel: CatalogChannel,
): Promise<{ products: number; listings: number }> {
  const conn = await getOAuthConnection(clientId, channel);
  if (!conn?.access_token) {
    return { products: 0, listings: 0 };
  }

  let rows: CatalogProductRow[] = [];

  switch (channel) {
    case "nuvemshop":
      rows = await pullNuvemshopProducts(conn.external_account ?? "", conn.access_token);
      break;
    case "shopify": {
      const shop = String((conn.metadata as Record<string, unknown>)?.shop ?? conn.external_account);
      rows = await pullShopifyProducts(shop, conn.access_token);
      break;
    }
    case "mercado_livre":
      rows = await pullMercadoLivreProducts(conn.external_account ?? "", conn.access_token);
      break;
    case "shopee":
      rows = await pullShopeeProducts(conn.external_account ?? "", conn.access_token);
      break;
    case "amazon":
      rows = await pullAmazonProducts(conn.external_account ?? "", conn.access_token);
      break;
    case "tiktok":
      rows = await pullTikTokProducts(conn.external_account ?? "", conn.access_token);
      break;
  }

  return upsertCatalogRows(clientId, channel, rows);
}

export async function syncAllClientCatalog(
  clientId: string,
  options?: { publishAfterSync?: boolean },
): Promise<Record<string, { products: number; listings: number }>> {
  const result: Record<string, { products: number; listings: number }> = {};

  for (const channel of CHANNELS) {
    try {
      result[channel] = await pullProductsFromChannel(clientId, channel);
    } catch (err) {
      console.warn(`[catalog] pull ${channel} failed:`, err);
      result[channel] = { products: 0, listings: 0 };
    }
  }

  if (options?.publishAfterSync !== false) {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("sku")
      .eq("client_id", clientId);
    const { publishSkuToAllChannels } = await import("./catalog-publish.server");
    for (const p of products ?? []) {
      await publishSkuToAllChannels(clientId, p.sku as string).catch((err) =>
        console.warn(`[catalog] publish ${p.sku}:`, err),
      );
    }
  }

  return result;
}

export async function syncAllCatalogs(): Promise<{ clients: number }> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  let count = 0;
  for (const client of clients ?? []) {
    await syncAllClientCatalog(client.id);
    count += 1;
  }
  return { clients: count };
}
