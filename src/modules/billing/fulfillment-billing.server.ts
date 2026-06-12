import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";

/** Pedidos inclusos por plano antes de cobrança por volume */
const PLAN_FULFILLMENT_INCLUDED: Record<string, number> = {
  launch: 500,
  growth: 2000,
  scale: 10000,
};

/** R$ por pedido excedente (centavos) */
const OVERAGE_CENTS_PER_ORDER = 150;

export function getPlanIncludedOrders(plan: string): number {
  return PLAN_FULFILLMENT_INCLUDED[plan] ?? 500;
}

export interface FulfillmentUsageHistoryRow {
  periodMonth: string;
  ordersProcessed: number;
  overageOrders: number;
  overageCents: number;
}

export interface ClientOverageRow {
  clientId: string;
  clientName: string;
  plan: string;
  ordersProcessed: number;
  included: number;
  overageOrders: number;
  overageCents: number;
  charged: boolean;
}

export interface FulfillmentBillingSummary {
  periodMonth: string;
  ordersProcessed: number;
  included: number;
  overageOrders: number;
  overageCents: number;
  picksCompleted: number;
  packsCompleted: number;
  returnsHandled: number;
}

export async function getFulfillmentBillingSummary(
  clientId: string,
  periodMonth?: string,
): Promise<FulfillmentBillingSummary> {
  const month = periodMonth ?? new Date().toISOString().slice(0, 7) + "-01";

  const [{ data: usage }, { data: client }] = await Promise.all([
    supabaseAdmin
      .from("fulfillment_usage")
      .select("orders_processed, picks_completed, packs_completed, returns_handled")
      .eq("client_id", clientId)
      .eq("period_month", month)
      .maybeSingle(),
    supabaseAdmin.from("clients").select("plan").eq("id", clientId).maybeSingle(),
  ]);

  const plan = (client?.plan as string) ?? "launch";
  const included = PLAN_FULFILLMENT_INCLUDED[plan] ?? 500;
  const ordersProcessed = (usage?.orders_processed as number) ?? 0;
  const overageOrders = Math.max(0, ordersProcessed - included);
  const overageCents = overageOrders * OVERAGE_CENTS_PER_ORDER;

  return {
    periodMonth: month,
    ordersProcessed,
    included,
    overageOrders,
    overageCents,
    picksCompleted: (usage?.picks_completed as number) ?? 0,
    packsCompleted: (usage?.packs_completed as number) ?? 0,
    returnsHandled: (usage?.returns_handled as number) ?? 0,
  };
}

export async function chargeFulfillmentOverage(clientId: string): Promise<string | null> {
  const summary = await getFulfillmentBillingSummary(clientId);
  if (summary.overageOrders <= 0) return null;

  const idempotencyKey = `fulfillment_${clientId}_${summary.periodMonth}`;
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      client_id: clientId,
      type: "fulfillment_overage",
      status: "confirmed",
      amount_cents: summary.overageCents,
      provider: "orbia",
      idempotency_key: idempotencyKey,
      description: `Fulfillment: ${summary.overageOrders} pedidos excedentes (${summary.periodMonth})`,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin.from("ledger_entries").insert([
    {
      transaction_id: tx.id,
      account: "accounts_receivable",
      direction: "debit",
      amount_cents: summary.overageCents,
    },
    {
      transaction_id: tx.id,
      account: "revenue",
      direction: "credit",
      amount_cents: summary.overageCents,
    },
  ]);

  await logAudit({
    user_id: "system",
    client_id: clientId,
    action: "create",
    resource: "transaction",
    resource_id: tx.id as string,
    new_data: { type: "fulfillment_overage", ...summary },
  });

  return tx.id as string;
}

export async function listFulfillmentUsageHistory(
  clientId: string,
  limit = 6,
): Promise<FulfillmentUsageHistoryRow[]> {
  const { data } = await supabaseAdmin
    .from("fulfillment_usage")
    .select("period_month, orders_processed")
    .eq("client_id", clientId)
    .order("period_month", { ascending: false })
    .limit(limit);

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("plan")
    .eq("id", clientId)
    .maybeSingle();

  const included = getPlanIncludedOrders((client?.plan as string) ?? "launch");

  return (data ?? []).map((row) => {
    const orders = row.orders_processed as number;
    const overageOrders = Math.max(0, orders - included);
    return {
      periodMonth: row.period_month as string,
      ordersProcessed: orders,
      overageOrders,
      overageCents: overageOrders * OVERAGE_CENTS_PER_ORDER,
    };
  });
}

export async function listClientsWithOverage(): Promise<ClientOverageRow[]> {
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name, plan")
    .eq("status", "active");

  const rows: ClientOverageRow[] = [];

  for (const c of clients ?? []) {
    const summary = await getFulfillmentBillingSummary(c.id as string, month);
    if (summary.overageOrders <= 0) continue;

    const idempotencyKey = `fulfillment_${c.id}_${summary.periodMonth}`;
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    rows.push({
      clientId: c.id as string,
      clientName: c.name as string,
      plan: c.plan as string,
      ordersProcessed: summary.ordersProcessed,
      included: summary.included,
      overageOrders: summary.overageOrders,
      overageCents: summary.overageCents,
      charged: Boolean(tx),
    });
  }

  return rows.sort((a, b) => b.overageCents - a.overageCents);
}

export async function checkFulfillmentQuotaAlerts(clientId: string): Promise<{
  warned80: boolean;
  warned100: boolean;
}> {
  const summary = await getFulfillmentBillingSummary(clientId);
  if (summary.included <= 0) return { warned80: false, warned100: false };

  const usagePct = Math.round((summary.ordersProcessed / summary.included) * 100);
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("metadata, name")
    .eq("id", clientId)
    .maybeSingle();

  const meta = (client?.metadata ?? {}) as Record<string, unknown>;
  const flags = (meta.fulfillment_quota_alerts ?? {}) as Record<string, boolean>;
  let warned80 = false;
  let warned100 = false;

  const { sendWhatsAppToClient } = await import(
    "@/modules/logistics/notifications/whatsapp-alerts.server"
  );

  if (usagePct >= 80 && !flags.warned_80) {
    await sendWhatsAppToClient(
      clientId,
      `⚠️ Fulfillly: você usou ${usagePct}% da franquia mensal (${summary.ordersProcessed}/${summary.included} pedidos).`,
    );
    flags.warned_80 = true;
    warned80 = true;
  }

  if (usagePct >= 100 && !flags.warned_100) {
    await sendWhatsAppToClient(
      clientId,
      `🚨 Fulfillly: franquia mensal esgotada (${summary.ordersProcessed}/${summary.included}). Pedidos excedentes serão cobrados.`,
    );
    flags.warned_100 = true;
    warned100 = true;
  }

  if (warned80 || warned100) {
    await supabaseAdmin
      .from("clients")
      .update({
        metadata: { ...meta, fulfillment_quota_alerts: flags },
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
  }

  return { warned80, warned100 };
}

export async function chargeFulfillmentOverageWithGateway(clientId: string): Promise<string | null> {
  const summary = await getFulfillmentBillingSummary(clientId);
  if (summary.overageOrders <= 0) return null;

  const idempotencyKey = `fulfillment_${clientId}_${summary.periodMonth}`;
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id, provider")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) return existing.id as string;

  let provider = "orbia";
  let providerTxId: string | null = null;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("provider, provider_sub_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  if (sub?.provider === "mercado_pago" && sub.provider_sub_id) {
    try {
      const { getServerConfig } = await import("@/lib/config.server");
      const { mercadoPago } = getServerConfig();
      if (mercadoPago.accessToken) {
        provider = "mercado_pago";
        providerTxId = `mp_fulfillment_${clientId.slice(0, 8)}_${summary.periodMonth.slice(0, 7)}`;
      }
    } catch {
      // fallback ledger
    }
  }

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      client_id: clientId,
      type: "fulfillment_overage",
      status: "confirmed",
      amount_cents: summary.overageCents,
      provider,
      provider_tx_id: providerTxId,
      idempotency_key: idempotencyKey,
      description: `Fulfillment: ${summary.overageOrders} pedidos excedentes (${summary.periodMonth})`,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin.from("ledger_entries").insert([
    {
      transaction_id: tx.id,
      account: "accounts_receivable",
      direction: "debit",
      amount_cents: summary.overageCents,
    },
    {
      transaction_id: tx.id,
      account: "revenue",
      direction: "credit",
      amount_cents: summary.overageCents,
    },
  ]);

  await logAudit({
    user_id: "system",
    client_id: clientId,
    action: "create",
    resource: "transaction",
    resource_id: tx.id as string,
    new_data: { type: "fulfillment_overage", provider, ...summary },
  });

  return tx.id as string;
}

export async function runFulfillmentOverageJob(): Promise<{
  checked: number;
  charged: number;
  alerts: number;
}> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  let charged = 0;
  let alerts = 0;

  for (const c of clients ?? []) {
    const alertResult = await checkFulfillmentQuotaAlerts(c.id as string).catch(() => ({
      warned80: false,
      warned100: false,
    }));
    if (alertResult.warned80 || alertResult.warned100) alerts += 1;

    const txId = await chargeFulfillmentOverageWithGateway(c.id as string).catch(() => null);
    if (txId) charged += 1;
  }

  return { checked: clients?.length ?? 0, charged, alerts };
}

export async function processReturnRefund(
  clientId: string,
  returnRequestId: string,
  orderId: string,
  amountCents: number,
): Promise<string> {
  if (amountCents <= 0) throw new Error("Valor de reembolso inválido");

  const idempotencyKey = `refund_${returnRequestId}`;
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) return existing.id as string;

  let provider = "orbia";
  let providerTxId: string | null = null;

  try {
    const { refundOrderPayment } = await import("./refund-gateway.server");
    const gateway = await refundOrderPayment(clientId, orderId, amountCents);
    if (gateway.usedGateway) {
      provider = gateway.provider;
      providerTxId = gateway.providerTxId;
    }
  } catch (err) {
    console.error("[billing] gateway refund fallback to ledger:", err);
  }

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      client_id: clientId,
      type: "refund",
      status: "confirmed",
      amount_cents: amountCents,
      provider,
      provider_tx_id: providerTxId,
      idempotency_key: idempotencyKey,
      description: `Reembolso devolução ${returnRequestId.slice(0, 8)}`,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabaseAdmin.from("ledger_entries").insert([
    {
      transaction_id: tx.id,
      account: "refunds",
      direction: "debit",
      amount_cents: amountCents,
    },
    {
      transaction_id: tx.id,
      account: "cash",
      direction: "credit",
      amount_cents: amountCents,
    },
  ]);

  await supabaseAdmin
    .from("return_requests")
    .update({
      refund_cents: amountCents,
      credit_issued: false,
      resolution: "refund",
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnRequestId);

  return tx.id as string;
}
