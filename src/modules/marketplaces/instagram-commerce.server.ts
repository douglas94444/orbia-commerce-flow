import { createHmac, timingSafeEqual } from "node:crypto";
import { metaFetch } from "@/integrations/meta/client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerConfig } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { getMarketplaceConnection } from "./_oauth.server";

export interface InstagramCatalogSyncResult {
  synced: number;
  catalogId: string | null;
}

export interface PostAttribution {
  postId: string | null;
  mediaType: string | null;
  campaignId: string | null;
  adId: string | null;
}

export interface MetaAdsAttributionLink {
  orderId: string;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  spendCents: number;
}

export async function syncInstagramCatalogToMeta(
  clientId: string,
): Promise<InstagramCatalogSyncResult> {
  const conn = await getMarketplaceConnection(clientId, "instagram");
  if (!conn) return { synced: 0, catalogId: null };

  const end = startTimer();
  const catalogId = String(conn.metadata.catalog_id ?? conn.externalAccount ?? "");

  const { data: listings } = await supabaseAdmin
    .from("channel_listings")
    .select("external_product_id, metadata, products(name, price_cents, sku)")
    .eq("client_id", clientId)
    .eq("channel", "instagram");

  let synced = 0;
  for (const listing of listings ?? []) {
    const product = listing.products as {
      name?: string;
      price_cents?: number;
      sku?: string;
    } | null;
    if (!product || !catalogId) continue;

    try {
      await metaFetch(
        `/${catalogId}/products`,
        conn.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            retailer_id: product.sku,
            name: product.name,
            price: ((product.price_cents ?? 0) / 100).toFixed(2),
            currency: "BRL",
            availability: "in stock",
          }),
        },
      );
      synced += 1;
    } catch {
      /* individual product sync may fail */
    }
  }

  await logIntegration({
    client_id: clientId,
    provider: "instagram",
    operation: "sync_catalog_to_meta",
    status: synced > 0 ? "success" : "error",
    duration_ms: end(),
    metadata: { synced, catalogId },
  });

  return { synced, catalogId: catalogId || null };
}

export function hardenInstagramOrderWebhook(
  payload: string,
  signatureHeader: string | null,
): { valid: boolean; parsed: Record<string, unknown> | null } {
  const { meta } = getServerConfig();
  const secret = meta.appSecret;

  if (!secret || !signatureHeader) {
    return { valid: false, parsed: null };
  }

  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, parsed: null };
  }

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const object = String(parsed.object ?? "");
    if (object !== "instagram" && object !== "page") {
      return { valid: false, parsed: null };
    }
    return { valid: true, parsed };
  } catch {
    return { valid: false, parsed: null };
  }
}

export function attributeOrderFromPostMetadata(
  orderMetadata: Record<string, unknown>,
): PostAttribution {
  const ig = (orderMetadata.instagram ?? orderMetadata.ig ?? {}) as Record<string, unknown>;
  const utm = (orderMetadata.utm ?? {}) as Record<string, unknown>;

  return {
    postId: ig.post_id ? String(ig.post_id) : utm.content ? String(utm.content) : null,
    mediaType: ig.media_type ? String(ig.media_type) : null,
    campaignId: utm.campaign ? String(utm.campaign) : null,
    adId: ig.ad_id ? String(ig.ad_id) : utm.term ? String(utm.term) : null,
  };
}

export async function linkMetaAdsAttribution(
  clientId: string,
  orderId: string,
): Promise<MetaAdsAttributionLink | null> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("external_id, value_cents, metadata")
    .eq("client_id", clientId)
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const attribution = attributeOrderFromPostMetadata(meta);

  const metaConn = await getMarketplaceConnection(clientId, "meta");
  let spendCents = 0;

  if (metaConn && attribution.adId) {
    try {
      const ad = await metaFetch<{ spend?: string }>(
        `/${attribution.adId}/insights?fields=spend`,
        metaConn.accessToken,
      );
      spendCents = Math.round(Number(ad.spend ?? 0) * 100);
    } catch {
      /* insights may be unavailable */
    }
  }

  await supabaseAdmin
    .from("orders")
    .update({
      metadata: {
        ...meta,
        meta_ads_attribution: {
          campaign_id: attribution.campaignId,
          ad_id: attribution.adId,
          post_id: attribution.postId,
          spend_cents: spendCents,
          linked_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  return {
    orderId: order.external_id as string,
    campaignId: attribution.campaignId,
    adsetId: null,
    adId: attribution.adId,
    spendCents,
  };
}

export async function syncInstagramCommerceAdvanced(clientId: string): Promise<{
  catalogSynced: number;
  catalogId: string | null;
}> {
  const result = await syncInstagramCatalogToMeta(clientId);
  return { catalogSynced: result.synced, catalogId: result.catalogId };
}
