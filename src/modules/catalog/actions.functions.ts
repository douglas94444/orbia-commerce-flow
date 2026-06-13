import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncAllCatalogs, syncAllClientCatalog } from "./sync-catalog.server";
import type { CatalogChannel } from "./sync-catalog.server";
import { computeChannelPrice } from "./pricing-engine.server";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  ncm: string | null;
  priceCents: number | null;
  isActive: boolean;
}

export interface ChannelListingRow {
  id: string;
  channel: string;
  sku: string;
  productName: string;
  externalProductId: string;
  externalVariantId: string | null;
  channelPriceCents: number | null;
  listingStatus: string;
  lastSyncedAt: string | null;
}

export interface PricingRuleRow {
  id: string;
  channel: string;
  ruleType: string;
  value: number;
  minPriceCents: number | null;
  isActive: boolean;
}

export interface StockBufferRow {
  id: string;
  channel: string;
  bufferPct: number;
  blackoutWhenZero: boolean;
}

async function resolveClientId(
  supabase: { rpc: (fn: string) => Promise<{ data: string | null; error: unknown }>; from: (t: string) => unknown },
): Promise<string> {
  const { data: clientId } = await supabase.rpc("current_client_id");
  if (clientId) return clientId;
  const q = supabase.from("clients") as {
    select: (c: string) => { limit: (n: number) => Promise<{ data: Array<{ id: string }> | null }> };
  };
  const { data: clients } = await q.select("id").limit(1);
  if (!clients?.[0]?.id) throw new Error("Cliente não identificado");
  return clients[0].id;
}

async function requireStaff(
  userId: string,
  supabase: { from: (t: string) => ReturnType<import("@supabase/supabase-js").SupabaseClient["from"]> },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
    throw new Error("Apenas equipe Orbia.");
  }
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProductRow[]> => {
    const { data, error } = await context.supabase
      .from("products")
      .select("id, sku, name, ncm, price_cents, is_active")
      .order("sku");

    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      ncm: r.ncm,
      priceCents: r.price_cents,
      isActive: r.is_active,
    }));
  });

export const listChannelListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChannelListingRow[]> => {
    const { data, error } = await context.supabase
      .from("channel_listings")
      .select("id, channel, external_product_id, external_variant_id, channel_price_cents, listing_status, last_synced_at, products(sku, name)")
      .order("channel");

    if (error) throw new Error(error.message);

    return (data ?? []).map((r: {
      id: string;
      channel: string;
      external_product_id: string;
      external_variant_id: string | null;
      channel_price_cents: number | null;
      listing_status: string;
      last_synced_at: string | null;
      products: { sku: string; name: string } | null;
    }) => ({
      id: r.id,
      channel: r.channel,
      sku: r.products?.sku ?? "—",
      productName: r.products?.name ?? "—",
      externalProductId: r.external_product_id,
      externalVariantId: r.external_variant_id,
      channelPriceCents: r.channel_price_cents,
      listingStatus: r.listing_status,
      lastSyncedAt: r.last_synced_at,
    }));
  });

const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const syncClientCatalog = createServerFn({ method: "POST" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    return syncAllClientCatalog(data.clientId);
  });

export const syncAllCatalogsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.userId, context.supabase);
    return syncAllCatalogs();
  });

const skuChannelsSchema = z.object({
  sku: z.string().min(1),
  channels: z.array(z.string()).optional(),
});

export const publishSkuToChannelsFn = createServerFn({ method: "POST" })
  .inputValidator(skuChannelsSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { publishSkuToChannel } = await import("./catalog-publish.server");
    const channels = (data.channels ?? [
      "nuvemshop", "shopify", "mercado_livre", "shopee", "amazon", "tiktok",
    ]) as CatalogChannel[];

    const result: Record<string, { priceCents: number; stockQty: number } | null> = {};
    for (const ch of channels) {
      result[ch] = await publishSkuToChannel(clientId, ch, data.sku);
    }
    return result;
  });

const previewPriceSchema = z.object({
  sku: z.string().min(1),
  channel: z.string().min(1),
});

export const previewChannelPriceFn = createServerFn({ method: "GET" })
  .inputValidator(previewPriceSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: product } = await context.supabase
      .from("products")
      .select("price_cents")
      .eq("sku", data.sku)
      .maybeSingle();
    if (!product?.price_cents) return { priceCents: 0 };
    const priceCents = await computeChannelPrice(
      clientId,
      data.channel as CatalogChannel,
      product.price_cents,
    );
    return { priceCents };
  });

export const getPricingRulesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PricingRuleRow[]> => {
    const clientId = await resolveClientId(context.supabase);
    const { data } = await context.supabase
      .from("channel_pricing_rules")
      .select("id, channel, rule_type, value, min_price_cents, is_active")
      .eq("client_id", clientId);
    return (data ?? []).map((r) => ({
      id: r.id,
      channel: r.channel,
      ruleType: r.rule_type,
      value: Number(r.value),
      minPriceCents: r.min_price_cents,
      isActive: r.is_active,
    }));
  });

const upsertPricingSchema = z.object({
  channel: z.string(),
  ruleType: z.enum(["margin_pct", "markup_pct", "fixed_cents"]),
  value: z.number(),
  minPriceCents: z.number().optional(),
});

export const upsertPricingRuleFn = createServerFn({ method: "POST" })
  .inputValidator(upsertPricingSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { error } = await supabaseAdmin.from("channel_pricing_rules").upsert(
      {
        client_id: clientId,
        channel: data.channel,
        rule_type: data.ruleType,
        value: data.value,
        min_price_cents: data.minPriceCents ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,channel,rule_type" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStockBuffersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StockBufferRow[]> => {
    const clientId = await resolveClientId(context.supabase);
    const { data } = await context.supabase
      .from("channel_stock_buffers")
      .select("id, channel, buffer_pct, blackout_when_zero")
      .eq("client_id", clientId);
    return (data ?? []).map((r) => ({
      id: r.id,
      channel: r.channel,
      bufferPct: Number(r.buffer_pct),
      blackoutWhenZero: r.blackout_when_zero,
    }));
  });

const upsertBufferSchema = z.object({
  channel: z.string(),
  bufferPct: z.number().min(0).max(100),
  blackoutWhenZero: z.boolean().optional(),
});

export const upsertStockBufferFn = createServerFn({ method: "POST" })
  .inputValidator(upsertBufferSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { error } = await supabaseAdmin.from("channel_stock_buffers").upsert(
      {
        client_id: clientId,
        channel: data.channel,
        buffer_pct: data.bufferPct,
        blackout_when_zero: data.blackoutWhenZero ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,channel" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
