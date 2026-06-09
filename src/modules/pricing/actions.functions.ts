import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generatePricingRecommendations } from "./pricing.server";

const clientIdSchema = z.object({ clientId: z.string().uuid() });

export const listPricingRecommendations = createServerFn({ method: "GET" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("pricing_recommendations")
      .select("id, sku, current_cents, suggested_cents, margin_pct, rationale, confidence, status")
      .eq("client_id", data.clientId)
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const refreshPricingRecommendations = createServerFn({ method: "POST" })
  .inputValidator(clientIdSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();
    if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
      throw new Error("Apenas equipe Orbia.");
    }
    const created = await generatePricingRecommendations(data.clientId);
    return { created };
  });

export const applyPricingRecommendation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ recommendationId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: rec } = await supabaseAdmin
      .from("pricing_recommendations")
      .select("client_id, sku, suggested_cents")
      .eq("id", data.recommendationId)
      .single();

    if (!rec) throw new Error("Recomendação não encontrada");

    await supabaseAdmin
      .from("products")
      .update({ price_cents: rec.suggested_cents, updated_at: new Date().toISOString() })
      .eq("client_id", rec.client_id)
      .eq("sku", rec.sku);

    await supabaseAdmin
      .from("pricing_recommendations")
      .update({ status: "applied" })
      .eq("id", data.recommendationId);

    return { ok: true };
  });
