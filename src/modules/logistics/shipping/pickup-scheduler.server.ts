import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PICKUP_THRESHOLD = 15;

export async function checkScheduledPickup(): Promise<{ alertsCreated: number }> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("client_id")
    .eq("status", "despachado")
    .gte("updated_at", since.toISOString());

  const counts = new Map<string, number>();
  for (const o of orders ?? []) {
    const cid = o.client_id as string;
    counts.set(cid, (counts.get(cid) ?? 0) + 1);
  }

  let alertsCreated = 0;
  for (const [clientId, count] of counts) {
    if (count < PICKUP_THRESHOLD) continue;

    const { data: existing } = await supabaseAdmin
      .from("operation_alerts")
      .select("id")
      .eq("client_id", clientId)
      .eq("kind", "sla")
      .ilike("title", "%Coleta%")
      .gte("created_at", since.toISOString())
      .maybeSingle();

    if (existing) continue;

    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "sla",
      severity: "warning",
      title: "Coleta transportadora recomendada",
      message: `${count} pedidos despachados hoje — agende coleta com a transportadora.`,
      is_resolved: false,
    });
    alertsCreated += 1;
  }

  return { alertsCreated };
}
