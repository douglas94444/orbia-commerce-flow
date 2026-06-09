import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPreapproval, getPayment, getPreapproval } from "@/integrations/mercado-pago";
import { getServerConfig } from "@/lib/config.server";

export const PLAN_PRICES: Record<string, number> = {
  launch: 350000,
  growth: 900000,
  scale: 1800000,
};

const PLAN_LABELS: Record<string, string> = {
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

async function recordSubscriptionPayment(
  clientId: string,
  plan: string,
  amountCents: number,
  providerTxId: string,
): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("transactions")
    .select("id")
    .eq("provider_tx_id", providerTxId)
    .maybeSingle();

  if (existing) return;

  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .insert({
      client_id: clientId,
      type: "subscription",
      status: "confirmed",
      amount_cents: amountCents,
      provider: "mercado_pago",
      provider_tx_id: providerTxId,
      idempotency_key: `mp_${providerTxId}`,
      description: `Assinatura ${plan} — Mercado Pago`,
    })
    .select("id")
    .single();

  if (tx?.id) {
    await supabaseAdmin.from("ledger_entries").insert([
      { transaction_id: tx.id, account: "accounts_receivable", direction: "debit", amount_cents: amountCents },
      { transaction_id: tx.id, account: "revenue", direction: "credit", amount_cents: amountCents },
    ]);
  }
}

export async function startMercadoPagoSubscription(
  clientId: string,
  plan: "launch" | "growth" | "scale",
  payerEmail: string,
): Promise<{ initPoint: string; preapprovalId: string }> {
  const amountCents = PLAN_PRICES[plan];
  const { appUrl } = getServerConfig();
  const externalReference = `orbia:${clientId}:${plan}`;

  const preapproval = await createPreapproval({
    reason: `Orbia — Plano ${PLAN_LABELS[plan]}`,
    payerEmail,
    externalReference,
    amountCents,
    backUrl: `${appUrl}/portal/settings?mp=success`,
  });

  await supabaseAdmin.from("subscriptions").upsert(
    {
      client_id: clientId,
      plan,
      status: "trialing",
      amount_cents: amountCents,
      provider: "mercado_pago",
      provider_sub_id: preapproval.id,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );

  return { initPoint: preapproval.init_point, preapprovalId: preapproval.id };
}

export async function handleMercadoPagoWebhook(payload: Record<string, unknown>): Promise<void> {
  const type = String(payload.type ?? "");
  const data = payload.data as Record<string, unknown> | undefined;
  const resourceId = String(data?.id ?? "");

  if (type === "subscription_preapproval" && resourceId) {
    const preapproval = await getPreapproval(resourceId);
    const status = String(preapproval.status ?? "");
    const extRef = String(preapproval.external_reference ?? "");
    const [, clientId, plan] = extRef.split(":");

    if (!clientId) return;

    const subStatus =
      status === "authorized" ? "active" : status === "paused" ? "paused" : status === "cancelled" ? "cancelled" : "trialing";

    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: subStatus,
        provider_sub_id: resourceId,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (subStatus === "active" && plan) {
      await supabaseAdmin
        .from("clients")
        .update({ plan, status: "active", updated_at: new Date().toISOString() })
        .eq("id", clientId);
    }
    return;
  }

  if (type === "payment" && resourceId) {
    const payment = await getPayment(resourceId);
    const status = String(payment.status ?? "");
    const extRef = String(payment.external_reference ?? "");
    const [, clientId, plan] = extRef.split(":");

    if (!clientId || status !== "approved") return;

    const amountCents = Math.round(Number(payment.transaction_amount ?? 0) * 100);
    await recordSubscriptionPayment(clientId, plan ?? "growth", amountCents, resourceId);

    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    if (plan) {
      await supabaseAdmin
        .from("clients")
        .update({ plan, status: "active", updated_at: new Date().toISOString() })
        .eq("id", clientId);
    }
  }
}
