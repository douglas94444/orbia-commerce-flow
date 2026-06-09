import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { cancelPreapproval } from "@/integrations/mercado-pago";
import { startMercadoPagoSubscription } from "./mercado-pago.server";
import { startPagarMeSubscription } from "./pagar-me.server";

// ─── Types ────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  clientId: string;
  clientName: string;
  plan: "launch" | "growth" | "scale";
  status: "trialing" | "active" | "past_due" | "cancelled" | "paused";
  amountBrl: number; // in reais
  provider: string;
  currentPeriodEnd: string | null;
}

export interface MrrStats {
  totalMrrCents: number;
  byPlan: Array<{ plan: string; count: number; mrrCents: number }>;
}

export interface Transaction {
  id: string;
  clientName: string;
  type: string;
  status: string;
  amountBrl: number;
  provider: string;
  description: string | null;
  createdAt: string;
}

// ─── listSubscriptions ────────────────────────────────────────

export const listSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Subscription[]> => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("*, clients(name)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map(
      (row: {
        id: string;
        client_id: string;
        plan: string;
        status: string;
        amount_cents: number;
        provider: string;
        current_period_end: string | null;
        clients: { name: string } | null;
      }): Subscription => ({
        id: row.id,
        clientId: row.client_id,
        clientName: row.clients?.name ?? "—",
        plan: row.plan as Subscription["plan"],
        status: row.status as Subscription["status"],
        amountBrl: Math.round(row.amount_cents / 100),
        provider: row.provider,
        currentPeriodEnd: row.current_period_end,
      }),
    );
  });

// ─── getMrrStats ──────────────────────────────────────────────

export const getMrrStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MrrStats> => {
    const { data } = await context.supabase
      .from("subscriptions")
      .select("plan, amount_cents, status")
      .eq("status", "active");

    const rows = data ?? [];
    const totalMrrCents = rows.reduce(
      (s: number, r: { amount_cents: number }) => s + r.amount_cents,
      0,
    );

    const byPlan = ["launch", "growth", "scale"].map((plan) => {
      const planRows = rows.filter((r: { plan: string }) => r.plan === plan);
      return {
        plan,
        count: planRows.length,
        mrrCents: planRows.reduce(
          (s: number, r: { amount_cents: number }) => s + r.amount_cents,
          0,
        ),
      };
    });

    return { totalMrrCents, byPlan };
  });

// ─── listTransactions ─────────────────────────────────────────

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Transaction[]> => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, type, status, amount_cents, provider, description, created_at, clients(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return (data ?? []).map(
      (row: {
        id: string;
        type: string;
        status: string;
        amount_cents: number;
        provider: string;
        description: string | null;
        created_at: string;
        clients: { name: string } | null;
      }): Transaction => ({
        id: row.id,
        clientName: row.clients?.name ?? "—",
        type: row.type,
        status: row.status,
        amountBrl: Math.round(row.amount_cents / 100),
        provider: row.provider,
        description: row.description,
        createdAt: row.created_at,
      }),
    );
  });

// ─── createSubscription ───────────────────────────────────────

const PLAN_PRICES: Record<string, number> = {
  launch: 350000, // R$ 3.500 em centavos
  growth: 900000, // R$ 9.000
  scale: 1800000, // R$ 18.000
};

const createSubSchema = z.object({
  clientId: z.string().uuid(),
  plan: z.enum(["launch", "growth", "scale"]),
  provider: z.enum(["stripe", "pagar_me", "manual", "mercado_pago"]).default("manual"),
  providerSubId: z.string().optional(),
});

export const createSubscription = createServerFn({ method: "POST" })
  .inputValidator(createSubSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // Staff only
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role)) {
      throw new Error("Apenas membros da equipe Orbia podem criar assinaturas.");
    }

    const amountCents = PLAN_PRICES[data.plan];

    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          client_id: data.clientId,
          plan: data.plan,
          status: "active",
          amount_cents: amountCents,
          provider: data.provider,
          provider_sub_id: data.providerSubId ?? null,
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "client_id" },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Record initial transaction
    const idempotencyKey = `sub_${data.clientId}_${Date.now()}`;
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .insert({
        client_id: data.clientId,
        type: "subscription",
        status: "confirmed",
        amount_cents: amountCents,
        provider: data.provider,
        idempotency_key: idempotencyKey,
        description: `Assinatura ${data.plan} — ativação`,
      })
      .select("id")
      .single();

    // Double-entry ledger
    if (tx?.id) {
      await supabaseAdmin.from("ledger_entries").insert([
        {
          transaction_id: tx.id,
          account: "accounts_receivable",
          direction: "debit",
          amount_cents: amountCents,
        },
        {
          transaction_id: tx.id,
          account: "revenue",
          direction: "credit",
          amount_cents: amountCents,
        },
      ]);
    }

    // Update client plan
    await supabaseAdmin
      .from("clients")
      .update({ plan: data.plan, status: "active", updated_at: new Date().toISOString() })
      .eq("id", data.clientId);

    await logAudit({
      user_id: context.userId,
      client_id: data.clientId,
      action: "create",
      resource: "subscription",
      resource_id: sub.id,
      new_data: { plan: data.plan, amount_cents: amountCents },
    });

    return sub;
  });

const mpCheckoutSchema = z.object({
  plan: z.enum(["launch", "growth", "scale"]),
});

const pagarMeCheckoutSchema = z.object({
  plan: z.enum(["launch", "growth", "scale"]),
});

export const startPagarMeCheckout = createServerFn({ method: "POST" })
  .inputValidator(pagarMeCheckoutSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("client_members")
      .select("client_id, role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role as string)) {
      throw new Error("Apenas owner/admin pode gerenciar assinatura.");
    }

    let email = String((context.claims as { email?: string }).email ?? "");
    let name = "";
    if (!email) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      email = authUser.user?.email ?? "";
      name = authUser.user?.user_metadata?.full_name ?? "Lojista";
    }

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    if (profile?.full_name) name = profile.full_name;

    if (!email) throw new Error("E-mail do usuário não encontrado.");

    return startPagarMeSubscription(membership.client_id, data.plan, email, name || "Lojista");
  });

export const startMercadoPagoCheckout = createServerFn({ method: "POST" })
  .inputValidator(mpCheckoutSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("client_members")
      .select("client_id, role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role as string)) {
      throw new Error("Apenas owner/admin pode gerenciar assinatura.");
    }

    let email = String((context.claims as { email?: string }).email ?? "");
    if (!email) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      email = authUser.user?.email ?? "";
    }
    if (!email) throw new Error("E-mail do usuário não encontrado.");

    return startMercadoPagoSubscription(membership.client_id, data.plan, email);
  });

export const getClientSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: membership } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!membership) return null;

    const { data } = await context.supabase
      .from("subscriptions")
      .select("plan, status, amount_cents, provider, current_period_end")
      .eq("client_id", membership.client_id)
      .maybeSingle();

    return data;
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    const isStaff = profile && ["orbia_admin", "orbia_staff"].includes(profile.role as string);

    const { data: membership } = await context.supabase
      .from("client_members")
      .select("client_id, role")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!isStaff && (!membership || !["owner", "admin"].includes(membership.role as string))) {
      throw new Error("Sem permissão para cancelar assinatura.");
    }

    const clientId = membership?.client_id;
    if (!clientId && !isStaff) throw new Error("Cliente não encontrado.");

    const targetClientId = clientId!;
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("provider_sub_id, provider")
      .eq("client_id", targetClientId)
      .maybeSingle();

    if (sub?.provider === "mercado_pago" && sub.provider_sub_id) {
      await cancelPreapproval(sub.provider_sub_id);
    }

    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("client_id", targetClientId);

    return { ok: true };
  });

