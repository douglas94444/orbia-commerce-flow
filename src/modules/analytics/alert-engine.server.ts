import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface AlertInsert {
  client_id: string;
  kind: string;
  severity: string;
  title: string;
  message: string;
}

export async function refreshOperationAlerts(clientId: string): Promise<void> {
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name, health_score, roas_avg")
    .eq("id", clientId)
    .single();

  if (!client) return;

  const alerts: AlertInsert[] = [];

  if (Number(client.roas_avg) > 0 && Number(client.roas_avg) < 4) {
    alerts.push({
      client_id: clientId,
      kind: "roas",
      severity: "critical",
      title: "ROAS abaixo do threshold",
      message: `${client.name}: ROAS ${Number(client.roas_avg).toFixed(1)}x — meta 4,0x`,
    });
  }

  if (client.health_score < 50) {
    alerts.push({
      client_id: clientId,
      kind: "health",
      severity: "critical",
      title: "Health score crítico",
      message: `${client.name}: score ${client.health_score}/100`,
    });
  } else if (client.health_score < 80) {
    alerts.push({
      client_id: clientId,
      kind: "health",
      severity: "warning",
      title: "Health score em atenção",
      message: `${client.name}: score ${client.health_score}/100`,
    });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("status")
    .eq("client_id", clientId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  const total = orders?.length ?? 0;
  const delivered = orders?.filter((o) => o.status === "entregue").length ?? 0;
  if (total >= 5) {
    const sla = (delivered / total) * 100;
    if (sla < 80) {
      alerts.push({
        client_id: clientId,
        kind: "sla",
        severity: "warning",
        title: "SLA logístico baixo",
        message: `${client.name}: ${sla.toFixed(0)}% entregues em 30d`,
      });
    }
  }

  const { data: inventory } = await supabaseAdmin
    .from("inventory")
    .select("sku, units, reserved")
    .eq("client_id", clientId);

  const critical = (inventory ?? []).filter((i) => i.units - i.reserved <= 5);
  if (critical.length > 0) {
    alerts.push({
      client_id: clientId,
      kind: "stock",
      severity: "warning",
      title: "Estoque crítico",
      message: `${client.name}: ${critical.length} SKU(s) com ≤5 unidades`,
    });
  }

  await supabaseAdmin
    .from("operation_alerts")
    .update({ is_resolved: true })
    .eq("client_id", clientId)
    .eq("is_resolved", false);

  if (alerts.length) {
    await supabaseAdmin.from("operation_alerts").insert(alerts);
  }
}
