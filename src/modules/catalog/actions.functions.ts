import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { syncAllCatalogs, syncAllClientCatalog } from "./sync-catalog.server";

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
  lastSyncedAt: string | null;
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
      .select("id, channel, external_product_id, external_variant_id, last_synced_at, products(sku, name)")
      .order("channel");

    if (error) throw new Error(error.message);

    return (data ?? []).map((r: {
      id: string;
      channel: string;
      external_product_id: string;
      external_variant_id: string | null;
      last_synced_at: string | null;
      products: { sku: string; name: string } | null;
    }) => ({
      id: r.id,
      channel: r.channel,
      sku: r.products?.sku ?? "—",
      productName: r.products?.name ?? "—",
      externalProductId: r.external_product_id,
      externalVariantId: r.external_variant_id,
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
