import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import type { Tables } from "@/integrations/supabase/types";
import type { Client } from "@/shared/types/orbia";

// ─── Helpers ─────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toUiClient(row: Tables<"clients">): Client {
  const words = row.name.trim().split(/\s+/);
  const initials = words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return {
    id: row.id,
    name: row.name,
    initials,
    plan: row.plan as Client["plan"],
    healthScore: row.health_score,
    gmv30d: Math.round(row.gmv_30d / 100), // cents → reais
    roas: Number(row.roas_avg),
    lastContactDays: row.last_contact_days,
    onboardingStage: row.onboarding_week,
    segment: row.segment ?? "Geral",
    status: row.status as Client["status"],
  };
}

// ─── listClients ─────────────────────────────────────────────
// Staff → all clients (RLS resolves via is_orbia_staff)
// Lojista → their own client only (RLS resolves via current_client_id)

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .order("health_score", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toUiClient);
  });

// ─── getPortfolioStats ────────────────────────────────────────

export interface PortfolioStats {
  total: number;
  healthy: number; // health_score >= 80
  atRisk: number; // health_score < 50
  onboarding: number;
  avgHealth: number;
  avgRoas: number;
}

export const getPortfolioStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortfolioStats> => {
    const { data } = await context.supabase
      .from("clients")
      .select("health_score, roas_avg, status");

    const rows = data ?? [];
    const total = rows.length;
    const healthy = rows.filter((r) => r.health_score >= 80).length;
    const atRisk = rows.filter((r) => r.health_score < 50).length;
    const onboarding = rows.filter((r) => r.status === "onboarding").length;
    const avgHealth =
      total > 0 ? Math.round(rows.reduce((s, r) => s + r.health_score, 0) / total) : 0;
    const avgRoas = total > 0 ? rows.reduce((s, r) => s + Number(r.roas_avg), 0) / total : 0;

    return { total, healthy, atRisk, onboarding, avgHealth, avgRoas };
  });

// ─── getClient ────────────────────────────────────────────────

export interface ClientDetail extends Client {
  connections: Array<{
    provider: string;
    externalAccount: string | null;
    isActive: boolean;
    lastRefreshed: string | null;
    healthStatus?: "healthy" | "degraded" | "down" | "unknown";
  }>;
  recentActivity: Array<{ provider: string; operation: string; status: string; createdAt: string }>;
}

const getClientSchema = z.object({ id: z.string().uuid() });

export const getClient = createServerFn({ method: "GET" })
  .inputValidator(getClientSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<ClientDetail> => {
    const [clientResult, connectionsResult, activityResult] = await Promise.all([
      context.supabase.from("clients").select("*").eq("id", data.id).single(),
      context.supabase
        .from("oauth_connections")
        .select("provider, external_account, is_active, last_refreshed_at")
        .eq("client_id", data.id),
      context.supabase
        .from("integration_logs")
        .select("provider, operation, status, created_at")
        .eq("client_id", data.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (clientResult.error) throw new Error(clientResult.error.message);
    const row = clientResult.data;

    const { getIntegrationHealthForClient } = await import(
      "@/modules/integrations/integration-health.server"
    );
    const healthRows = await getIntegrationHealthForClient(data.id);
    const healthByProvider = new Map(healthRows.map((h) => [h.provider, h.status]));

    return {
      ...toUiClient(row),
      connections: (connectionsResult.data ?? []).map((c) => ({
        provider: c.provider,
        externalAccount: c.external_account,
        isActive: c.is_active,
        lastRefreshed: c.last_refreshed_at,
        healthStatus: healthByProvider.get(c.provider) ?? "unknown",
      })),
      recentActivity: (activityResult.data ?? []).map((a) => ({
        provider: a.provider,
        operation: a.operation,
        status: a.status,
        createdAt: a.created_at,
      })),
    };
  });

// ─── createClient ─────────────────────────────────────────────

const createClientSchema = z.object({
  name: z.string().min(2, "Nome mínimo de 2 caracteres").max(100),
  plan: z.enum(["launch", "growth", "scale"]),
  segment: z.string().max(60).optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const createClient = createServerFn({ method: "POST" })
  .inputValidator(createClientSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // Explicit authorization check (defense in depth — RLS is the primary boundary)
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role)) {
      throw new Error("Apenas membros da equipe Orbia podem criar clientes.");
    }

    const slug = generateSlug(data.name);

    // Use service client for the insert (staff role validation already done above)
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .insert({
        name: data.name,
        slug,
        plan: data.plan,
        segment: data.segment ?? null,
        status: "onboarding",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Já existe um cliente com o nome "${data.name}".`);
      }
      throw new Error(error.message);
    }

    // Assign current staff member as account manager
    await supabaseAdmin.from("client_members").insert({
      client_id: client.id,
      user_id: context.userId,
      role: "admin",
      status: "active",
      invited_by: context.userId,
    });

    // Audit trail
    await logAudit({
      user_id: context.userId,
      client_id: client.id,
      action: "client_provision",
      resource: "client",
      resource_id: client.id,
      new_data: client,
    });

    return toUiClient(client);
  });

// ─── getCurrentClient ─────────────────────────────────────────

export interface CurrentClientContext {
  clientId: string;
  clientName: string;
  memberRole: string;
  plan: Client["plan"];
  healthScore: number;
  gmv30d: number;
  roas: number;
  connections: Array<{ provider: string; isActive: boolean }>;
}

export const getCurrentClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentClientContext> => {
    const { data: membership, error: memErr } = await context.supabase
      .from("client_members")
      .select("client_id, role, clients(id, name, plan, health_score, gmv_30d, roas_avg)")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();

    if (memErr) throw new Error(memErr.message);
    if (!membership?.clients) {
      throw new Error("Nenhum cliente vinculado a este usuário.");
    }

    const client = membership.clients as {
      id: string;
      name: string;
      plan: Client["plan"];
      health_score: number;
      gmv_30d: number;
      roas_avg: number;
    };

    const { data: connections } = await context.supabase
      .from("oauth_connections")
      .select("provider, is_active")
      .eq("client_id", client.id);

    return {
      clientId: client.id,
      clientName: client.name,
      memberRole: membership.role,
      plan: client.plan,
      healthScore: client.health_score,
      gmv30d: Math.round(client.gmv_30d / 100),
      roas: Number(client.roas_avg),
      connections: (connections ?? []).map((c) => ({
        provider: c.provider,
        isActive: c.is_active,
      })),
    };
  });

// ─── inviteClientMember ─────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "manager", "viewer", "fulfillment_operator"]).default("viewer"),
  clientId: z.string().uuid().optional(),
});

export const inviteClientMember = createServerFn({ method: "POST" })
  .inputValidator(inviteSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();

    const isStaff = profile && ["orbia_admin", "orbia_staff"].includes(profile.role);

    let clientId = data.clientId;

    if (isStaff && clientId) {
      // staff inviting to explicit client
    } else if (!clientId) {
      const { data: membership } = await context.supabase
        .from("client_members")
        .select("client_id, role")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .maybeSingle();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new Error("Sem permissão para convidar membros.");
      }
      clientId = membership.client_id;
    } else {
      const { data: membership } = await context.supabase
        .from("client_members")
        .select("role")
        .eq("user_id", context.userId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();

      if (!membership || !["owner", "admin"].includes(membership.role)) {
        throw new Error("Sem permissão para convidar membros deste cliente.");
      }
    }

    if (!clientId) throw new Error("clientId obrigatório");

    const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      { data: { invited_to_client: clientId } },
    );

    if (inviteErr) throw new Error(inviteErr.message);

    const userId = invited.user?.id;
    if (userId) {
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        role: "member",
        full_name: data.email.split("@")[0],
      });

      await supabaseAdmin.from("client_members").upsert(
        {
          client_id: clientId,
          user_id: userId,
          role: data.role,
          status: "active",
          invited_by: context.userId,
        },
        { onConflict: "client_id,user_id" },
      );
    }

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "member_invite",
      resource: "client_member",
      new_data: { email: data.email, role: data.role },
    });

    return { invited: true };
  });
