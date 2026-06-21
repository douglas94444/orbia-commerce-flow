import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { logAudit } from "@/shared/lib/logger";
import {
  cestSchema,
  cfopSchema,
  cstSchemaForRegime,
  icmsOrigemSchema,
  icmsRatesSchema,
  ncmSchema,
} from "@/modules/fiscal/product-fiscal-validation.server";
import { validateProductFiscalReadiness } from "@/modules/fiscal/product-fiscal-readiness.server";
import { suggestProductNcm } from "@/modules/fiscal/suggest-product-ncm.server";
import { syncAllCatalogs, syncAllClientCatalog } from "./sync-catalog.server";
import type { CatalogChannel } from "./sync-catalog.server";
import { computeChannelPrice } from "./pricing-engine.server";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  ncm: string | null;
  cfop: string | null;
  cfopIntra: string | null;
  cfopInter: string | null;
  cfopReturnIntra: string | null;
  cfopReturnInter: string | null;
  cst: string | null;
  cest: string | null;
  icmsSt: boolean;
  icmsOrigem: string;
  icmsRates: Record<string, number>;
  priceCents: number | null;
  isActive: boolean;
}

export interface FiscalTemplateRow {
  id: string;
  segment: string;
  name: string;
  defaultNcm: string | null;
  cfopIntra: string | null;
  cfopInter: string | null;
  cfopReturnIntra: string | null;
  cfopReturnInter: string | null;
  defaultCst: string | null;
  cest: string | null;
  icmsSt: boolean;
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
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
): Promise<string> {
  const { data: clientId } = await supabase.rpc("current_client_id");
  if (clientId) return clientId;
  const { data: clients } = await supabase.from("clients").select("id").limit(1);
  if (!clients?.[0]?.id) throw new Error("Cliente não identificado");
  return clients[0].id;
}

async function requireStaff(
  userId: string,
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
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
      .select(
        "id, sku, name, ncm, cfop, cfop_intra, cfop_inter, cfop_return_intra, cfop_return_inter, cst, cest, icms_st, icms_origem, icms_rates, price_cents, is_active",
      )
      .order("sku");

    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      ncm: r.ncm,
      cfop: r.cfop,
      cfopIntra: r.cfop_intra ?? r.cfop,
      cfopInter: r.cfop_inter,
      cfopReturnIntra: r.cfop_return_intra,
      cfopReturnInter: r.cfop_return_inter,
      cst: r.cst,
      cest: r.cest,
      icmsSt: Boolean(r.icms_st),
      icmsOrigem: (r.icms_origem as string) ?? "0",
      icmsRates: (r.icms_rates as Record<string, number>) ?? {},
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

async function getTaxRegime(clientId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("fiscal_configs")
    .select("tax_regime")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data?.tax_regime as string) ?? "simples";
}

const productFiscalSchema = z.object({
  productId: z.string().uuid(),
  ncm: ncmSchema,
  cfopIntra: cfopSchema,
  cfopInter: cfopSchema,
  cfopReturnIntra: cfopSchema,
  cfopReturnInter: cfopSchema,
  cst: z.string().max(10).optional().nullable(),
  cest: cestSchema,
  icmsSt: z.boolean().optional(),
  icmsOrigem: icmsOrigemSchema,
  icmsRates: icmsRatesSchema,
});

export const upsertProductFiscal = createServerFn({ method: "POST" })
  .inputValidator(productFiscalSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const taxRegime = await getTaxRegime(clientId);

    if (data.cst) {
      const parsed = cstSchemaForRegime(taxRegime).safeParse(data.cst);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "CST inválido");
    }

    const { data: existing } = await context.supabase
      .from("products")
      .select("sku, ncm, cfop_intra, cst")
      .eq("id", data.productId)
      .single();

    const { error } = await context.supabase
      .from("products")
      .update({
        ncm: data.ncm ?? null,
        cfop_intra: data.cfopIntra ?? null,
        cfop_inter: data.cfopInter ?? null,
        cfop_return_intra: data.cfopReturnIntra ?? null,
        cfop_return_inter: data.cfopReturnInter ?? null,
        cfop: data.cfopIntra ?? null,
        cst: data.cst ?? null,
        cest: data.cest ?? null,
        icms_st: data.icmsSt ?? false,
        icms_origem: data.icmsOrigem ?? "0",
        icms_rates: data.icmsRates ?? {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.productId);

    if (error) throw new Error(error.message);

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "product_fiscal",
      resource_id: data.productId,
      old_data: existing ?? undefined,
      new_data: data,
    });

    return { ok: true };
  });

export const getProductFiscalReadinessFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    return validateProductFiscalReadiness(clientId);
  });

const suggestNcmSchema = z.object({
  productName: z.string().min(2),
  category: z.string().optional(),
});

export const suggestProductNcmFn = createServerFn({ method: "POST" })
  .inputValidator(suggestNcmSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => suggestProductNcm(data.productName, data.category));

export const listFiscalTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FiscalTemplateRow[]> => {
    const clientId = await resolveClientId(context.supabase);
    const { data, error } = await context.supabase
      .from("fiscal_product_templates")
      .select(
        "id, segment, name, default_ncm, cfop_intra, cfop_inter, cfop_return_intra, cfop_return_inter, default_cst, cest, icms_st",
      )
      .eq("client_id", clientId)
      .order("segment");

    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => ({
      id: r.id,
      segment: r.segment,
      name: r.name,
      defaultNcm: r.default_ncm,
      cfopIntra: r.cfop_intra,
      cfopInter: r.cfop_inter,
      cfopReturnIntra: r.cfop_return_intra,
      cfopReturnInter: r.cfop_return_inter,
      defaultCst: r.default_cst,
      cest: r.cest,
      icmsSt: Boolean(r.icms_st),
    }));
  });

const upsertTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  segment: z.string().min(1),
  name: z.string().min(1),
  defaultNcm: ncmSchema,
  cfopIntra: cfopSchema,
  cfopInter: cfopSchema,
  cfopReturnIntra: cfopSchema,
  cfopReturnInter: cfopSchema,
  defaultCst: z.string().max(10).optional().nullable(),
  cest: cestSchema,
  icmsSt: z.boolean().optional(),
});

export const upsertFiscalTemplateFn = createServerFn({ method: "POST" })
  .inputValidator(upsertTemplateSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const row = {
      client_id: clientId,
      segment: data.segment,
      name: data.name,
      default_ncm: data.defaultNcm ?? null,
      cfop_intra: data.cfopIntra ?? null,
      cfop_inter: data.cfopInter ?? null,
      cfop_return_intra: data.cfopReturnIntra ?? null,
      cfop_return_inter: data.cfopReturnInter ?? null,
      default_cst: data.defaultCst ?? null,
      cest: data.cest ?? null,
      icms_st: data.icmsSt ?? false,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("fiscal_product_templates")
        .update(row)
        .eq("id", data.id)
        .eq("client_id", clientId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("fiscal_product_templates").upsert(row, {
        onConflict: "client_id,segment",
      });
      if (error) throw new Error(error.message);
    }

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: data.id ? "update" : "create",
      resource: "fiscal_product_template",
      resource_id: data.id ?? data.segment,
      new_data: data,
    });

    return { ok: true };
  });

const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).min(1),
});

export const applyFiscalTemplateFn = createServerFn({ method: "POST" })
  .inputValidator(applyTemplateSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);

    const { data: tpl, error: tplErr } = await context.supabase
      .from("fiscal_product_templates")
      .select("*")
      .eq("id", data.templateId)
      .single();

    if (tplErr || !tpl) throw new Error("Template não encontrado");

    const { error } = await context.supabase
      .from("products")
      .update({
        ncm: tpl.default_ncm,
        cfop_intra: tpl.cfop_intra,
        cfop_inter: tpl.cfop_inter,
        cfop_return_intra: tpl.cfop_return_intra,
        cfop_return_inter: tpl.cfop_return_inter,
        cfop: tpl.cfop_intra,
        cst: tpl.default_cst,
        cest: tpl.cest,
        icms_st: tpl.icms_st,
        updated_at: new Date().toISOString(),
      })
      .in("id", data.productIds);

    if (error) throw new Error(error.message);

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "product_fiscal_bulk",
      resource_id: data.templateId,
      new_data: { productIds: data.productIds, templateId: data.templateId },
    });

    return { ok: true, count: data.productIds.length };
  });

const bulkFiscalCsvSchema = z.object({
  csv: z.string().min(1),
});

export const bulkImportProductFiscalFn = createServerFn({ method: "POST" })
  .inputValidator(bulkFiscalCsvSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const taxRegime = await getTaxRegime(clientId);
    const lines = data.csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV deve ter cabeçalho e ao menos uma linha");

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const skuIdx = header.indexOf("sku");
    const ncmIdx = header.indexOf("ncm");
    if (skuIdx < 0) throw new Error("Coluna 'sku' obrigatória");

    let updated = 0;
    for (const line of lines.slice(1)) {
      const cols = line.split(",").map((c) => c.trim());
      const sku = cols[skuIdx];
      if (!sku) continue;

      const patch: TablesUpdate<"products"> = { updated_at: new Date().toISOString() };
      if (ncmIdx >= 0 && cols[ncmIdx]) {
        const n = cols[ncmIdx].replace(/\D/g, "");
        if (n.length === 8) patch.ncm = n;
      }
      const cfopIntraIdx = header.indexOf("cfop_intra");
      if (cfopIntraIdx >= 0 && cols[cfopIntraIdx]) patch.cfop_intra = cols[cfopIntraIdx];
      const cfopInterIdx = header.indexOf("cfop_inter");
      if (cfopInterIdx >= 0 && cols[cfopInterIdx]) patch.cfop_inter = cols[cfopInterIdx];
      const cstIdx = header.indexOf("cst");
      if (cstIdx >= 0 && cols[cstIdx]) {
        const cst = cols[cstIdx];
        const parsed = cstSchemaForRegime(taxRegime).safeParse(cst);
        if (parsed.success) patch.cst = cst;
      }
      const cestIdx = header.indexOf("cest");
      if (cestIdx >= 0 && cols[cestIdx]) patch.cest = cols[cestIdx].replace(/\D/g, "");

      if (Object.keys(patch).length <= 1) continue;

      const { error } = await supabaseAdmin
        .from("products")
        .update(patch)
        .eq("client_id", clientId)
        .eq("sku", sku);

      if (!error) updated += 1;
    }

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "product_fiscal_csv",
      resource_id: "bulk",
      new_data: { updated },
    });

    return { ok: true, updated };
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
