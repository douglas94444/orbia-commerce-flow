import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { syncReceivablesFromTransactions } from "./receivables.server";

export const listReceivables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("receivables")
      .select("id, source, description, gross_cents, fee_cents, net_cents, expected_at, status, clients(name)")
      .order("expected_at", { ascending: true })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

const syncSchema = z.object({ clientId: z.string().uuid() });

export const syncReceivables = createServerFn({ method: "POST" })
  .inputValidator(syncSchema)
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
    const count = await syncReceivablesFromTransactions(data.clientId);
    return { synced: count };
  });
