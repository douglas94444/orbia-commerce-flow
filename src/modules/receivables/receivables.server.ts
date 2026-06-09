import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Consolida recebíveis de transações confirmadas + pedidos entregues pendentes. */
export async function syncReceivablesFromTransactions(clientId: string): Promise<number> {
  const { data: txs } = await supabaseAdmin
    .from("transactions")
    .select("id, amount_cents, provider, provider_tx_id, description, created_at, status")
    .eq("client_id", clientId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(100);

  let upserted = 0;

  for (const tx of txs ?? []) {
    const ref = tx.provider_tx_id ?? tx.id;
    const { data: existing } = await supabaseAdmin
      .from("receivables")
      .select("id")
      .eq("client_id", clientId)
      .eq("external_ref", ref)
      .maybeSingle();

    if (existing) continue;

    const feeCents = Math.round(tx.amount_cents * 0.0399);
    await supabaseAdmin.from("receivables").insert({
      client_id: clientId,
      source: tx.provider,
      external_ref: ref,
      description: tx.description ?? "Recebível consolidado",
      gross_cents: tx.amount_cents,
      fee_cents: feeCents,
      net_cents: tx.amount_cents - feeCents,
      expected_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: "pending",
    });
    upserted++;
  }

  return upserted;
}
