import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface EnrollInput {
  clientId: string;
  trigger: string;
  customerId: string | null;
  context?: Record<string, unknown>;
  delayMinutes?: number;
}

export async function enrollInSequence(input: EnrollInput): Promise<string | null> {
  const { data: sequences } = await supabaseAdmin
    .from("automation_sequences")
    .select("id, status, is_active")
    .eq("client_id", input.clientId)
    .eq("trigger", input.trigger)
    .eq("is_active", true)
    .eq("status", "active");

  if (!sequences?.length) return null;

  const sequence = sequences[0];

  if (input.customerId) {
    const { data: duplicate } = await supabaseAdmin
      .from("automation_enrollments")
      .select("id")
      .eq("sequence_id", sequence.id)
      .eq("customer_id", input.customerId)
      .in("status", ["active", "paused"])
      .maybeSingle();
    if (duplicate) return null;
  }

  const delayMs = (input.delayMinutes ?? 0) * 60_000;
  const nextRunAt = new Date(Date.now() + delayMs).toISOString();

  const { data: enrollment, error } = await supabaseAdmin
    .from("automation_enrollments")
    .insert({
      sequence_id: sequence.id,
      customer_id: input.customerId,
      client_id: input.clientId,
      current_step_index: 0,
      status: "active",
      next_run_at: nextRunAt,
      context: input.context ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[enrollment] failed:", error.message);
    return null;
  }
  return enrollment.id;
}

export async function cancelEnrollmentsForCustomer(
  customerId: string,
  reason = "opt_out",
): Promise<void> {
  await supabaseAdmin
    .from("automation_enrollments")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("status", "active");

  await supabaseAdmin
    .from("automation_enrollments")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      context: { cancel_reason: reason },
    })
    .eq("customer_id", customerId)
    .in("status", ["active", "paused"]);
}

export async function ensureDefaultSequences(clientId: string): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from("automation_sequences")
    .select("id")
    .eq("client_id", clientId)
    .limit(1);

  if (existing?.length) return;

  const defaults: Array<{ name: string; trigger: string; steps: Array<{ channel: string; delay: number; key: string }> }> = [
    {
      name: "Pós-entrega + avaliação",
      trigger: "pedido_entregue",
      steps: [
        { channel: "whatsapp", delay: 0, key: "pedido_entregue" },
        { channel: "email", delay: 0, key: "pedido_entregue" },
      ],
    },
    {
      name: "Upsell D+7",
      trigger: "pos_entrega_7d",
      steps: [{ channel: "whatsapp", delay: 0, key: "upsell_7d" }],
    },
    {
      name: "NF emitida",
      trigger: "nfe_autorizada",
      steps: [{ channel: "whatsapp", delay: 0, key: "nfe_confirmacao" }],
    },
    {
      name: "Pedido despachado",
      trigger: "pedido_despachado",
      steps: [
        { channel: "whatsapp", delay: 0, key: "pedido_despachado" },
        { channel: "email", delay: 0, key: "pedido_despachado" },
      ],
    },
    {
      name: "Carrinho abandonado",
      trigger: "carrinho_abandonado",
      steps: [
        { channel: "email", delay: 60, key: "carrinho_abandonado" },
        { channel: "whatsapp", delay: 180, key: "carrinho_abandonado" },
        { channel: "push", delay: 360, key: "carrinho_abandonado" },
        { channel: "sms", delay: 1440, key: "carrinho_abandonado" },
      ],
    },
    {
      name: "Reativação 30d",
      trigger: "reativacao_30d",
      steps: [{ channel: "email", delay: 0, key: "reativacao" }],
    },
    {
      name: "Reativação 60d",
      trigger: "reativacao_60d",
      steps: [
        { channel: "whatsapp", delay: 0, key: "reativacao" },
      ],
    },
    {
      name: "Reativação 90d",
      trigger: "reativacao_90d",
      steps: [
        { channel: "sms", delay: 0, key: "reativacao" },
      ],
    },
    {
      name: "Fidelidade — saldo pós-compra",
      trigger: "fidelidade_pontos",
      steps: [{ channel: "whatsapp", delay: 0, key: "fidelidade_pontos" }],
    },
    {
      name: "Aniversário",
      trigger: "aniversario",
      steps: [{ channel: "whatsapp", delay: 0, key: "aniversario" }],
    },
    {
      name: "Avaliação negativa",
      trigger: "avaliacao_negativa",
      steps: [{ channel: "whatsapp", delay: 0, key: "avaliacao_negativa" }],
    },
    {
      name: "1º aniversário de cliente",
      trigger: "aniversario_cliente",
      steps: [{ channel: "whatsapp", delay: 0, key: "aniversario" }],
    },
    {
      name: "Boleto gerado",
      trigger: "boleto_gerado",
      steps: [{ channel: "whatsapp", delay: 60, key: "boleto_lembrete" }],
    },
    {
      name: "Boleto vence em 24h",
      trigger: "boleto_vencimento",
      steps: [{ channel: "whatsapp", delay: 0, key: "boleto_lembrete" }],
    },
    {
      name: "Boleto expirado",
      trigger: "boleto_expirado",
      steps: [
        { channel: "whatsapp", delay: 0, key: "boleto_lembrete" },
        { channel: "sms", delay: 60, key: "boleto_lembrete" },
      ],
    },
    {
      name: "Produto favorito em estoque",
      trigger: "estoque_favorito",
      steps: [{ channel: "whatsapp", delay: 0, key: "estoque_favorito" }],
    },
    {
      name: "Cupom fidelidade",
      trigger: "fidelidade_cupom",
      steps: [{ channel: "whatsapp", delay: 0, key: "fidelidade_pontos" }],
    },
    {
      name: "Pontos expirando",
      trigger: "fidelidade_expira",
      steps: [{ channel: "whatsapp", delay: 0, key: "fidelidade_pontos" }],
    },
    {
      name: "Próximo nível fidelidade",
      trigger: "fidelidade_tier",
      steps: [{ channel: "whatsapp", delay: 0, key: "fidelidade_pontos" }],
    },
  ];

  for (const def of defaults) {
    const { data: seq } = await supabaseAdmin
      .from("automation_sequences")
      .insert({
        client_id: clientId,
        name: def.name,
        trigger: def.trigger,
        is_active: true,
        status: "active",
      })
      .select("id")
      .single();

    if (!seq) continue;

    for (let i = 0; i < def.steps.length; i++) {
      const s = def.steps[i];
      await supabaseAdmin.from("automation_steps").insert({
        sequence_id: seq.id,
        channel: s.channel,
        delay_minutes: s.delay,
        template_key: s.key,
        sort_order: i,
      });
    }

    // Legacy automation_flows row for UI compat (first step channel)
    await supabaseAdmin.from("automation_flows").insert({
      client_id: clientId,
      name: def.name,
      trigger: def.trigger,
      channel: def.steps[0].channel,
      is_active: true,
      sequence_id: seq.id,
    });
  }
}
