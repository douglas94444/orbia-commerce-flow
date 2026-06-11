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

export async function processReturnRefund(
  clientId: string,
  returnRequestId: string,
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

  const { data: tx, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      client_id: clientId,
      type: "refund",
      status: "confirmed",
      amount_cents: amountCents,
      provider: "orbia",
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
      credit_issued: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnRequestId);

  return tx.id as string;
}
