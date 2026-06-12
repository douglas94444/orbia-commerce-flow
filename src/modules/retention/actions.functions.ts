import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import type { AutomationFlow } from "@/shared/types/orbia";
import { simulateSequence } from "./flow-simulator.server";
import { listWhatsAppTemplates } from "./whatsapp-compliance.server";

const CHANNEL_LABEL: Record<string, "Email" | "SMS" | "WhatsApp" | "Push"> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push",
};

async function resolveClientId(
  supabase: { rpc: (fn: string) => Promise<{ data: string | null; error: unknown }>; from: (t: string) => unknown },
): Promise<string> {
  const { data: clientId } = await supabase.rpc("current_client_id");
  if (clientId) return clientId;
  const q = supabase.from("clients") as { select: (c: string) => { limit: (n: number) => Promise<{ data: Array<{ id: string }> | null }> } };
  const { data: clients } = await q.select("id").limit(1);
  if (!clients?.[0]?.id) throw new Error("Client context required");
  return clients[0].id;
}

const TRIGGER_LABEL: Record<string, string> = {
  carrinho_abandonado: "Carrinho abandonado",
  pedido_entregue: "Pedido entregue",
  pedido_despachado: "Pedido despachado",
  nfe_autorizada: "NF-e emitida",
  reativacao_30d: "Sem compra 30d",
  reativacao_60d: "Sem compra 60d",
  reativacao_90d: "Sem compra 90d",
  aniversario: "Aniversário",
  aniversario_cliente: "1º ano de cliente",
  pos_entrega_7d: "Upsell D+7",
  boleto_gerado: "Boleto gerado",
  avaliacao_negativa: "Avaliação negativa",
  estoque_favorito: "Produto favorito",
};

export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationFlow[]> => {
    const { data: sequences, error } = await context.supabase
      .from("automation_sequences")
      .select("id, name, trigger, is_active, sent_30d, recovered_cents, status")
      .order("is_active", { ascending: false })
      .order("sent_30d", { ascending: false });

    if (error) {
      const { data: flows, error: flowErr } = await context.supabase
        .from("automation_flows")
        .select("id, name, trigger, channel, is_active, sent_30d, recovered")
        .order("is_active", { ascending: false });
      if (flowErr) throw new Error(flowErr.message);
      return (flows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        trigger: TRIGGER_LABEL[row.trigger] ?? row.trigger,
        channel: CHANNEL_LABEL[row.channel] ?? "Email",
        active: row.is_active,
        sent30d: row.sent_30d,
        recovered: row.recovered,
        recoveredCents: 0,
      }));
    }

    const seqIds = (sequences ?? []).map((s) => s.id);
    const { data: steps } = seqIds.length
      ? await context.supabase
          .from("automation_steps")
          .select("sequence_id, channel")
          .in("sequence_id", seqIds)
          .order("sort_order")
      : { data: [] };

    const channelBySeq = new Map<string, string>();
    for (const st of steps ?? []) {
      if (!channelBySeq.has(st.sequence_id)) channelBySeq.set(st.sequence_id, st.channel);
    }

    return (sequences ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      trigger: TRIGGER_LABEL[row.trigger] ?? row.trigger,
      channel: CHANNEL_LABEL[channelBySeq.get(row.id) ?? "email"] ?? "Email",
      active: row.is_active && row.status !== "paused",
      sent30d: row.sent_30d,
      recovered: 0,
      recoveredCents: row.recovered_cents ?? 0,
    }));
  });

export interface RfmSegment {
  segment: string;
  label: string;
  count: number;
  tone: "success" | "primary" | "warning" | "danger" | "neutral";
  desc: string;
}

export interface DeliveryLogEntry {
  id: string;
  channel: string;
  status: string;
  sentAt: string;
  templateKey?: string;
}

export interface RetentionStats {
  avgLtv: number;
  recoveredValue: number;
  dispatches30d: number;
  customerCount: number;
  rfm: RfmSegment[];
  lifecycle: { stage: string; count: number }[];
  channelRates: { channel: string; sent: number; delivered: number }[];
  avgDaysToSecondOrder: number | null;
  recentDeliveries: DeliveryLogEntry[];
}

const RFM_MAP: Record<string, { label: string; tone: RfmSegment["tone"]; desc: string }> = {
  campeoes: { label: "Campeões", tone: "success", desc: "Compram muito e com frequência" },
  leais: { label: "Leais", tone: "primary", desc: "Frequência e valor altos" },
  em_risco: { label: "Em risco", tone: "warning", desc: "Recência caindo" },
  hibernando: { label: "Hibernando", tone: "danger", desc: "Sem compra há meses" },
  perdidos: { label: "Perdidos", tone: "danger", desc: "Lista fria" },
  novos: { label: "Novos", tone: "neutral", desc: "Primeira compra recente" },
  potencial: { label: "Potencial", tone: "primary", desc: "Alto valor, baixa frequência" },
};

export const getRetentionStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetentionStats> => {
    const [customersResult, sequencesResult, logsResult] = await Promise.all([
      context.supabase.from("customers").select("id, rfm_segment, ltv_cents, order_count, cold_list_at, last_order_at"),
      context.supabase.from("automation_sequences").select("sent_30d, recovered_cents"),
      supabaseAdmin
        .from("message_delivery_log")
        .select("id, channel, status, sent_at, metadata")
        .order("sent_at", { ascending: false })
        .limit(20),
    ]);

    const customers = customersResult.data ?? [];
    const sequences = sequencesResult.data ?? [];

    const customerCount = customers.length;
    const avgLtv =
      customerCount > 0
        ? Math.round(
            customers.reduce((s, c) => s + (c.ltv_cents ?? 0), 0) / customerCount / 100,
          )
        : 0;

    const dispatches30d = sequences.reduce((s, a) => s + (a.sent_30d ?? 0), 0);
    const recoveredValue = Math.round(
      sequences.reduce((s, a) => s + (a.recovered_cents ?? 0), 0) / 100,
    );

    const rfm = Object.entries(RFM_MAP).map(([key, meta]) => ({
      segment: key,
      ...meta,
      count: customers.filter((c) => (c.rfm_segment ?? "perdidos") === key).length,
    }));

    const lifecycle = [
      { stage: "Novos", count: customers.filter((c) => (c.order_count ?? 0) <= 1).length },
      { stage: "Ativos", count: customers.filter((c) => (c.order_count ?? 0) > 1 && !c.cold_list_at).length },
      { stage: "Em risco", count: customers.filter((c) => c.rfm_segment === "em_risco").length },
      { stage: "Frios", count: customers.filter((c) => c.cold_list_at).length },
    ];

    const { data: allLogs } = await supabaseAdmin
      .from("message_delivery_log")
      .select("channel, status")
      .gte("sent_at", new Date(Date.now() - 30 * 86_400_000).toISOString());

    const channelMap = new Map<string, { sent: number; delivered: number }>();
    for (const log of allLogs ?? []) {
      const cur = channelMap.get(log.channel) ?? { sent: 0, delivered: 0 };
      cur.sent += 1;
      if (["delivered", "opened", "clicked"].includes(log.status)) cur.delivered += 1;
      channelMap.set(log.channel, cur);
    }

    const { data: prefs } = await supabaseAdmin
      .from("customer_contact_prefs")
      .select("customer_id, first_purchase_at")
      .not("first_purchase_at", "is", null);

    const secondOrderDays: number[] = [];
    for (const c of customers.filter((cu) => (cu.order_count ?? 0) >= 2)) {
      const pref = (prefs ?? []).find((p) => p.customer_id === (c as { id?: string }).id);
      if (c.last_order_at && pref?.first_purchase_at) {
        const days = Math.round(
          (new Date(c.last_order_at).getTime() - new Date(pref.first_purchase_at).getTime()) /
            86_400_000,
        );
        if (days > 0) secondOrderDays.push(days);
      }
    }
    const avgDaysToSecondOrder =
      secondOrderDays.length > 0
        ? Math.round(secondOrderDays.reduce((a, b) => a + b, 0) / secondOrderDays.length)
        : null;

    const recentDeliveries: DeliveryLogEntry[] = (logsResult.data ?? []).map((l) => ({
      id: l.id,
      channel: l.channel,
      status: l.status,
      sentAt: l.sent_at,
      templateKey: (l.metadata as Record<string, unknown>)?.template_key as string | undefined,
    }));

    return {
      avgLtv,
      recoveredValue,
      dispatches30d,
      customerCount,
      rfm,
      lifecycle,
      channelRates: Array.from(channelMap.entries()).map(([channel, v]) => ({
        channel,
        ...v,
      })),
      avgDaysToSecondOrder,
      recentDeliveries,
    };
  });

const toggleSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export const toggleAutomation = createServerFn({ method: "POST" })
  .inputValidator(toggleSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const status = data.active ? "active" : "paused";

    const { error: seqErr } = await supabaseAdmin
      .from("automation_sequences")
      .update({
        is_active: data.active,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (seqErr) {
      const { error } = await supabaseAdmin
        .from("automation_flows")
        .update({ is_active: data.active, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    if (!data.active) {
      await supabaseAdmin
        .from("automation_enrollments")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("sequence_id", data.id)
        .eq("status", "active");
    } else {
      await supabaseAdmin
        .from("automation_enrollments")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("sequence_id", data.id)
        .eq("status", "paused");
    }

    await logAudit({
      user_id: context.userId,
      action: "update",
      resource: "automation_sequence",
      resource_id: data.id,
      new_data: { is_active: data.active, status },
    });

    return { success: true };
  });

const simulateSchema = z.object({ trigger: z.string() });

export const simulateAutomation = createServerFn({ method: "POST" })
  .inputValidator(simulateSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    return simulateSequence(clientId, data.trigger);
  });

export const getWhatsAppTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const clientId = await resolveClientId(context.supabase);
      return listWhatsAppTemplates(clientId);
    } catch {
      return [];
    }
  });

export interface LtvByDimension {
  dimension: string;
  label: string;
  avgLtv: number;
  count: number;
}

export const getLtvAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ byRfm: LtvByDimension[]; byChannel: LtvByDimension[] }> => {
    const { data: customers } = await context.supabase
      .from("customers")
      .select("rfm_segment, acquisition_channel, ltv_cents");

    const byRfmMap = new Map<string, { total: number; count: number }>();
    const byChannelMap = new Map<string, { total: number; count: number }>();

    for (const c of customers ?? []) {
      const seg = c.rfm_segment ?? "perdidos";
      const ch = c.acquisition_channel ?? "organico";
      const ltv = c.ltv_cents ?? 0;

      const rfm = byRfmMap.get(seg) ?? { total: 0, count: 0 };
      rfm.total += ltv;
      rfm.count += 1;
      byRfmMap.set(seg, rfm);

      const chAgg = byChannelMap.get(ch) ?? { total: 0, count: 0 };
      chAgg.total += ltv;
      chAgg.count += 1;
      byChannelMap.set(ch, chAgg);
    }

    const toRows = (map: Map<string, { total: number; count: number }>) =>
      Array.from(map.entries()).map(([key, v]) => ({
        dimension: key,
        label: RFM_MAP[key]?.label ?? key,
        avgLtv: v.count > 0 ? Math.round(v.total / v.count / 100) : 0,
        count: v.count,
      }));

    return { byRfm: toRows(byRfmMap), byChannel: toRows(byChannelMap) };
  });

const saveFlowSchema = z.object({
  sequenceId: z.string().uuid().optional(),
  name: z.string(),
  trigger: z.string(),
  steps: z.array(
    z.object({
      channel: z.enum(["email", "sms", "whatsapp", "push"]),
      delayMinutes: z.number(),
      templateKey: z.string(),
      conditionType: z.string().optional(),
    }),
  ),
  flowDefinition: z.record(z.unknown()).optional(),
});

export const saveAutomationFlow = createServerFn({ method: "POST" })
  .inputValidator(saveFlowSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);

    let sequenceId = data.sequenceId;

    if (sequenceId) {
      await supabaseAdmin
        .from("automation_sequences")
        .update({
          name: data.name,
          trigger: data.trigger,
          flow_definition: data.flowDefinition ?? {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", sequenceId);

      await supabaseAdmin.from("automation_steps").delete().eq("sequence_id", sequenceId);
    } else {
      const { data: seq, error } = await supabaseAdmin
        .from("automation_sequences")
        .insert({
          client_id: clientId,
          name: data.name,
          trigger: data.trigger,
          flow_definition: data.flowDefinition ?? {},
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      sequenceId = seq.id;
    }

    for (let i = 0; i < data.steps.length; i++) {
      const s = data.steps[i];
      await supabaseAdmin.from("automation_steps").insert({
        sequence_id: sequenceId,
        channel: s.channel,
        delay_minutes: s.delayMinutes,
        template_key: s.templateKey,
        condition_type: s.conditionType ?? null,
        sort_order: i,
      });
    }

    return { sequenceId };
  });

const quietHoursSchema = z.object({
  quietHoursStart: z.number().min(0).max(23),
  quietHoursEnd: z.number().min(0).max(23),
});

export const updateQuietHours = createServerFn({ method: "POST" })
  .inputValidator(quietHoursSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { error } = await supabaseAdmin
      .from("automation_sequences")
      .update({
        quiet_hours_start: data.quietHoursStart,
        quiet_hours_end: data.quietHoursEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getTemplateLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("automation_template_library")
      .select("id, vertical, trigger, channel, name, template_key, body_preview")
      .order("vertical");
    return data ?? [];
  });

const reviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
});

export const submitOrderReview = createServerFn({ method: "POST" })
  .inputValidator(reviewSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { submitOrderReview: submit } = await import("./reviews.server");
    return submit({
      clientId,
      orderId: data.orderId,
      rating: data.rating,
      comment: data.comment,
    });
  });

const wishlistSchema = z.object({
  productSku: z.string(),
  productName: z.string().optional(),
  productImage: z.string().optional(),
  customerId: z.string().uuid().optional(),
});

export const trackWishlistItem = createServerFn({ method: "POST" })
  .inputValidator(wishlistSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    let wishQuery = supabaseAdmin
      .from("wishlist_items")
      .select("id, view_count")
      .eq("client_id", clientId)
      .eq("product_sku", data.productSku);
    wishQuery = data.customerId
      ? wishQuery.eq("customer_id", data.customerId)
      : wishQuery.is("customer_id", null);
    const { data: existing } = await wishQuery.maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("wishlist_items")
        .update({
          view_count: existing.view_count + 1,
          product_name: data.productName,
          product_image: data.productImage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("wishlist_items").insert({
        client_id: clientId,
        customer_id: data.customerId ?? null,
        product_sku: data.productSku,
        product_name: data.productName,
        product_image: data.productImage,
      });
    }
    return { success: true };
  });

const abSchema = z.object({
  stepId: z.string().uuid(),
  variantAKey: z.string(),
  variantBKey: z.string(),
  trafficSplit: z.number().min(10).max(90).optional(),
});

export const createAbExperiment = createServerFn({ method: "POST" })
  .inputValidator(abSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("ab_experiments")
      .insert({
        step_id: data.stepId,
        variant_a_key: data.variantAKey,
        variant_b_key: data.variantBKey,
        traffic_split: data.trafficSplit ?? 50,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  sequenceName: z.string().optional(),
});

export const applyTemplateFromLibrary = createServerFn({ method: "POST" })
  .inputValidator(applyTemplateSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: tpl, error } = await supabaseAdmin
      .from("automation_template_library")
      .select("trigger, channel, name, template_key")
      .eq("id", data.templateId)
      .single();
    if (error || !tpl) throw new Error("Template não encontrado");

    const { data: seq } = await supabaseAdmin
      .from("automation_sequences")
      .insert({
        client_id: clientId,
        name: data.sequenceName ?? tpl.name,
        trigger: tpl.trigger,
      })
      .select("id")
      .single();

    await supabaseAdmin.from("automation_steps").insert({
      sequence_id: seq!.id,
      channel: tpl.channel,
      template_key: tpl.template_key,
      sort_order: 0,
    });

    return { sequenceId: seq!.id };
  });

export const getAutomationFlow = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sequenceId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: seq, error } = await context.supabase
      .from("automation_sequences")
      .select("id, name, trigger, flow_definition, quiet_hours_start, quiet_hours_end")
      .eq("id", data.sequenceId)
      .single();
    if (error || !seq) throw new Error("Fluxo não encontrado");

    const { data: steps } = await context.supabase
      .from("automation_steps")
      .select("id, channel, delay_minutes, template_key, condition_type, sort_order")
      .eq("sequence_id", data.sequenceId)
      .order("sort_order");

    return { sequence: seq, steps: steps ?? [] };
  });

export interface CohortRetentionRow {
  cohort: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
}

export const getCohortRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CohortRetentionRow[]> => {
    const clientId = await resolveClientId(context.supabase);
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("created_at, metadata")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    const byCustomerMonth = new Map<string, Set<string>>();
    for (const o of orders ?? []) {
      const meta = (o.metadata ?? {}) as Record<string, unknown>;
      const email = meta.customer_email ? String(meta.customer_email).toLowerCase() : "";
      const phone = meta.customer_phone ? String(meta.customer_phone) : "";
      const key = email ? `email:${email}` : phone ? `phone:${phone}` : null;
      if (!key) continue;
      const month = o.created_at.slice(0, 7);
      if (!byCustomerMonth.has(key)) byCustomerMonth.set(key, new Set());
      byCustomerMonth.get(key)!.add(month);
    }

    const cohorts = new Map<string, string[]>();
    for (const [customerKey, months] of byCustomerMonth) {
      const sorted = [...months].sort();
      const first = sorted[0];
      if (!first) continue;
      const list = cohorts.get(first) ?? [];
      list.push(customerKey);
      cohorts.set(first, list);
    }

    const addMonths = (ym: string, n: number) => {
      const [y, m] = ym.split("-").map(Number);
      const d = new Date(y, m - 1 + n, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const rows: CohortRetentionRow[] = [];
    for (const [cohort, customerKeys] of [...cohorts.entries()].slice(-4)) {
      const base = customerKeys.length || 1;
      const countActive = (offset: number) => {
        const target = addMonths(cohort, offset);
        return customerKeys.filter((id) => byCustomerMonth.get(id)?.has(target)).length;
      };
      rows.push({
        cohort,
        month0: 100,
        month1: Math.round((countActive(1) / base) * 100),
        month2: Math.round((countActive(2) / base) * 100),
        month3: Math.round((countActive(3) / base) * 100),
      });
    }
    return rows;
  });

const messageLogSchema = z.object({
  channel: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const getMessageDeliveryLog = createServerFn({ method: "POST" })
  .inputValidator(messageLogSchema.optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: enrollments } = await supabaseAdmin
      .from("automation_enrollments")
      .select("id")
      .eq("client_id", clientId);
    const enrollmentIds = (enrollments ?? []).map((e) => e.id);
    if (!enrollmentIds.length) return [];

    let query = supabaseAdmin
      .from("message_delivery_log")
      .select("id, channel, status, sent_at, opened_at, clicked_at, metadata, enrollment_id")
      .in("enrollment_id", enrollmentIds)
      .order("sent_at", { ascending: false })
      .limit(data?.limit ?? 50);

    if (data?.channel) query = query.eq("channel", data.channel);
    if (data?.status) query = query.eq("status", data.status);

    const { data: logs, error } = await query;
    if (error) throw new Error(error.message);
    return logs ?? [];
  });

export const getLoyaltySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: accounts } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("id, customer_id, points_balance, tier, tier_progress_pct")
      .eq("client_id", clientId)
      .order("points_balance", { ascending: false })
      .limit(20);

    const { data: totals } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("points_balance")
      .eq("client_id", clientId);

    const totalPoints = (totals ?? []).reduce((s, a) => s + (a.points_balance ?? 0), 0);
    return { accounts: accounts ?? [], totalPoints, accountCount: totals?.length ?? 0 };
  });

const redeemSchema = z.object({
  customerId: z.string().uuid(),
  points: z.number().min(100),
});

export const redeemLoyaltyPoints = createServerFn({ method: "POST" })
  .inputValidator(redeemSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { redeemPoints } = await import("./loyalty.server");
    const result = await redeemPoints(data.customerId, clientId, data.points);
    if (!result) throw new Error("Saldo insuficiente para resgate.");
    await logAudit({
      user_id: context.userId,
      action: "create",
      resource: "loyalty_redeem",
      resource_id: data.customerId,
      new_data: result,
    });
    return result;
  });

const deviceTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["web", "ios", "android"]).default("web"),
  customerId: z.string().uuid().optional(),
});

export const registerDeviceToken = createServerFn({ method: "POST" })
  .inputValidator(deviceTokenSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    await supabaseAdmin.from("device_tokens").upsert(
      {
        client_id: clientId,
        customer_id: data.customerId ?? null,
        token: data.token,
        platform: data.platform,
        is_active: true,
      },
      { onConflict: "client_id,token" },
    );
    return { success: true };
  });

export const listAbExperiments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: sequences } = await supabaseAdmin
      .from("automation_sequences")
      .select("id")
      .eq("client_id", clientId);
    const seqIds = (sequences ?? []).map((s) => s.id);
    if (!seqIds.length) return [];

    const { data: steps } = await supabaseAdmin
      .from("automation_steps")
      .select("id, sequence_id, template_key")
      .in("sequence_id", seqIds);
    const stepIds = (steps ?? []).map((s) => s.id);
    if (!stepIds.length) return [];

    const { data: experiments } = await supabaseAdmin
      .from("ab_experiments")
      .select("id, step_id, variant_a_key, variant_b_key, traffic_split, sends_a, sends_b, conversions_a, conversions_b, winner, is_active")
      .in("step_id", stepIds);

    return (experiments ?? []).map((e) => {
      const step = (steps ?? []).find((s) => s.id === e.step_id);
      return { ...e, stepTemplate: step?.template_key };
    });
  });

const waProviderSchema = z.object({
  provider: z.enum(["meta", "evolution"]),
});

export const updateWhatsAppProvider = createServerFn({ method: "POST" })
  .inputValidator(waProviderSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    await supabaseAdmin
      .from("clients")
      .update({ whatsapp_provider: data.provider, updated_at: new Date().toISOString() })
      .eq("id", clientId);
    return { success: true };
  });

export const syncWhatsAppTemplatesAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { syncWhatsAppTemplatesForClient } = await import("./whatsapp-templates-sync.server");
    return syncWhatsAppTemplatesForClient(clientId);
  });

const marketingOptInSchema = z.object({
  customerId: z.string().uuid(),
  optIn: z.boolean(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const setCustomerMarketingOptIn = createServerFn({ method: "POST" })
  .inputValidator(marketingOptInSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const { persistCustomerContact } = await import("./contact-resolver.server");
    await persistCustomerContact(data.customerId, {
      email: data.email,
      phone: data.phone,
      marketingOptIn: data.optIn,
    });
    return { success: true };
  });

export const getQuietHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data } = await supabaseAdmin
      .from("automation_sequences")
      .select("quiet_hours_start, quiet_hours_end")
      .eq("client_id", clientId)
      .limit(1)
      .maybeSingle();
    return {
      quietHoursStart: data?.quiet_hours_start ?? 22,
      quietHoursEnd: data?.quiet_hours_end ?? 8,
    };
  });

const couponValidateSchema = z.object({
  code: z.string().min(3),
  orderId: z.string().uuid().optional(),
});

export const validateAutomationCouponAction = createServerFn({ method: "POST" })
  .inputValidator(couponValidateSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { validateAutomationCoupon, redeemAutomationCoupon } = await import("./coupon-engine.server");
    const coupon = await validateAutomationCoupon(clientId, data.code);
    if (!coupon) return { valid: false as const };
    if (data.orderId) {
      await redeemAutomationCoupon(clientId, data.code, data.orderId);
    }
    return {
      valid: true as const,
      discountPct: coupon.discountPct,
      expiresAt: coupon.expiresAt,
    };
  });

export const getConsumerLoyalty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .single();

    const email = profile?.email?.toLowerCase();
    if (!email) return { account: null, transactions: [] };

    const { data: prefs } = await supabaseAdmin
      .from("customer_contact_prefs")
      .select("customer_id")
      .eq("contact_email", email)
      .maybeSingle();

    if (!prefs?.customer_id) return { account: null, transactions: [] };

    const { data: account } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("id, points_balance, tier, tier_progress_pct")
      .eq("customer_id", prefs.customer_id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!account) return { account: null, customerId: prefs.customer_id, transactions: [] };

    const { data: transactions } = await supabaseAdmin
      .from("loyalty_transactions")
      .select("type, points, created_at, order_id")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      customerId: prefs.customer_id,
      account,
      transactions: transactions ?? [],
    };
  });

export const getAutomationSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data: sequences } = await supabaseAdmin
      .from("automation_sequences")
      .select("id, name, trigger")
      .eq("client_id", clientId);
    const seqIds = (sequences ?? []).map((s) => s.id);
    if (!seqIds.length) return [];

    const { data: steps } = await supabaseAdmin
      .from("automation_steps")
      .select("id, sequence_id, channel, template_key, sort_order")
      .in("sequence_id", seqIds)
      .order("sort_order");

    return (steps ?? []).map((st) => {
      const seq = (sequences ?? []).find((s) => s.id === st.sequence_id);
      return {
        ...st,
        sequenceName: seq?.name,
        trigger: seq?.trigger,
        label: `${seq?.name ?? "Fluxo"} · ${st.channel} · ${st.template_key}`,
      };
    });
  });

const marketingSettingsSchema = z.object({
  implicitOptIn: z.boolean(),
});

export const updateMarketingSettings = createServerFn({ method: "POST" })
  .inputValidator(marketingSettingsSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    await supabaseAdmin
      .from("clients")
      .update({
        marketing_implicit_opt_in: data.implicitOptIn,
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
    return { success: true };
  });

export const backfillContactsAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { backfillCustomerContacts } = await import("./contact-backfill.server");
    return backfillCustomerContacts(clientId);
  });
