import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildMercadoLivreAuthUrl } from "@/integrations/mercado-livre";
import { buildMetaAuthUrl } from "@/integrations/meta";
import { buildNuvemshopAuthUrl } from "@/integrations/nuvemshop";
import { buildShopeeAuthUrl } from "@/integrations/shopee";
import { buildShopifyAuthUrl } from "@/integrations/shopify";
import { createOAuthState } from "./oauth.server";

async function requireStaff(
  userId: string,
  supabase: {
    from: (table: string) => ReturnType<import("@supabase/supabase-js").SupabaseClient["from"]>;
  },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
    throw new Error("Apenas equipe Orbia pode conectar integrações.");
  }
}

const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const startNuvemshopOAuth = createServerFn({ method: "POST" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const state = await createOAuthState(context.userId, data.clientId, "nuvemshop");
    return { url: buildNuvemshopAuthUrl(state) };
  });

const shopifyStartSchema = z.object({
  clientId: z.string().uuid(),
  shop: z.string().min(3).max(100),
});

export const startShopifyOAuth = createServerFn({ method: "POST" })
  .inputValidator(shopifyStartSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const shop = data.shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const state = await createOAuthState(context.userId, data.clientId, "shopify", { shop });
    return { url: buildShopifyAuthUrl(shop, state) };
  });

const shopeeStartSchema = z.object({
  clientId: z.string().uuid(),
  shopId: z.string().min(1).max(50),
});

export const startMercadoLivreOAuth = createServerFn({ method: "POST" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const state = await createOAuthState(context.userId, data.clientId, "mercado_livre");
    return { url: buildMercadoLivreAuthUrl(state) };
  });

export const startShopeeOAuth = createServerFn({ method: "POST" })
  .inputValidator(shopeeStartSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const state = await createOAuthState(context.userId, data.clientId, "shopee", {
      shop_id: data.shopId,
    });
    return { url: buildShopeeAuthUrl(data.shopId, state) };
  });

export const startMetaOAuth = createServerFn({ method: "POST" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaff(context.userId, context.supabase);
    const state = await createOAuthState(context.userId, data.clientId, "meta");
    return { url: buildMetaAuthUrl(state) };
  });
