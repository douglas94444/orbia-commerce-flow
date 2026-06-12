import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildClientLogisticsReport } from "./client-logistics-report.server";

export interface ClientQbrReport {
  clientId: string;
  logistics: Awaited<ReturnType<typeof buildClientLogisticsReport>>;
  traffic: {
    avgRoas: number;
    totalSpendCents: number;
    totalRevenueCents: number;
    campaignCount: number;
  };
  retention: {
    activeFlows: number;
    sent30d: number;
    recovered30d: number;
    customerCount: number;
  };
  billing: {
    mrrCents: number;
    ordersProcessed: number;
    overageCents: number;
  };
  fiscal: {
    nfeAuthorized30d: number;
  };
}

export async function buildClientQbrReport(clientId: string): Promise<ClientQbrReport> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [logistics, campaigns, flows, customers, billing, nfe] = await Promise.all([
    buildClientLogisticsReport(clientId),
    supabaseAdmin
      .from("campaigns")
      .select("spend_cents, revenue_cents, roas")
      .eq("client_id", clientId),
    supabaseAdmin
      .from("automation_flows")
      .select("is_active, sent_30d, recovered")
      .eq("client_id", clientId),
    supabaseAdmin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    import("@/modules/billing/fulfillment-billing.server").then((m) =>
      m.getFulfillmentBillingSummary(clientId),
    ),
    supabaseAdmin
      .from("nfe_emissions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "autorizada")
      .gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  const campRows = campaigns.data ?? [];
  const totalSpend = campRows.reduce((s, c) => s + (c.spend_cents as number), 0);
  const totalRevenue = campRows.reduce((s, c) => s + (c.revenue_cents as number), 0);
  const avgRoas =
    totalSpend > 0
      ? Math.round((totalRevenue / totalSpend) * 100) / 100
      : campRows.length
        ? Math.round(
            (campRows.reduce((s, c) => s + Number(c.roas ?? 0), 0) / campRows.length) * 10,
          ) / 10
        : 0;

  const flowRows = flows.data ?? [];

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("amount_cents")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();

  return {
    clientId,
    logistics,
    traffic: {
      avgRoas,
      totalSpendCents: totalSpend,
      totalRevenueCents: totalRevenue,
      campaignCount: campRows.length,
    },
    retention: {
      activeFlows: flowRows.filter((f) => f.is_active).length,
      sent30d: flowRows.reduce((s, f) => s + (f.sent_30d as number), 0),
      recovered30d: flowRows.reduce((s, f) => s + (f.recovered as number), 0),
      customerCount: customers.count ?? 0,
    },
    billing: {
      mrrCents: (subscription?.amount_cents as number) ?? 0,
      ordersProcessed: billing.ordersProcessed,
      overageCents: billing.overageCents,
    },
    fiscal: {
      nfeAuthorized30d: nfe.count ?? 0,
    },
  };
}

export async function buildClientQbrReportHtml(clientId: string): Promise<string> {
  const report = await buildClientQbrReport(clientId);
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();

  const month = new Date().toISOString().slice(0, 7);
  const fmt = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>QBR ${client?.name ?? clientId}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#111}
h1{font-size:1.5rem}h2{font-size:1rem;margin-top:1.5rem;color:#444}
table{width:100%;border-collapse:collapse;margin:.5rem 0}td,th{border:1px solid #ddd;padding:8px;font-size:14px}
th{background:#f5f5f5}.metric{font-size:1.5rem;font-weight:bold}</style></head><body>
<h1>QBR Fulfillly — ${client?.name ?? "Cliente"}</h1>
<p>Período: ${month}</p>
<h2>Logística</h2>
<table>
<tr><th>SLA cumprimento</th><td>${report.logistics.sla.compliancePercent}%</td></tr>
<tr><th>Acurácia picking</th><td>${report.logistics.analytics.pickingAccuracyPercent}%</td></tr>
<tr><th>Taxa incidentes</th><td>${report.logistics.analytics.incidentRatePercent}%</td></tr>
<tr><th>Pedidos processados</th><td>${report.logistics.billing.ordersProcessed}</td></tr>
</table>
<h2>Tráfego</h2>
<table>
<tr><th>ROAS médio</th><td>${report.traffic.avgRoas}x</td></tr>
<tr><th>Investimento</th><td>${fmt(report.traffic.totalSpendCents)}</td></tr>
<tr><th>Receita atribuída</th><td>${fmt(report.traffic.totalRevenueCents)}</td></tr>
</table>
<h2>Retenção</h2>
<table>
<tr><th>Fluxos ativos</th><td>${report.retention.activeFlows}</td></tr>
<tr><th>Enviados 30d</th><td>${report.retention.sent30d}</td></tr>
<tr><th>Recuperados 30d</th><td>${report.retention.recovered30d}</td></tr>
</table>
<h2>Billing & Fiscal</h2>
<table>
<tr><th>MRR</th><td>${fmt(report.billing.mrrCents)}</td></tr>
<tr><th>Excedente fulfillment</th><td>${fmt(report.billing.overageCents)}</td></tr>
<tr><th>NF-e autorizadas 30d</th><td>${report.fiscal.nfeAuthorized30d}</td></tr>
</table>
<p style="margin-top:2rem;font-size:12px;color:#666">Orbia Commerce Flow — QBR deck (salvar como PDF)</p>
</body></html>`;
}

export async function exportClientQbrCsv(clientId: string): Promise<string> {
  const report = await buildClientQbrReport(clientId);
  const lines = [
    "section,metric,value",
    `logistics,sla_compliance,${report.logistics.sla.compliancePercent}%`,
    `logistics,picking_accuracy,${report.logistics.analytics.pickingAccuracyPercent}%`,
    `logistics,incident_rate,${report.logistics.analytics.incidentRatePercent}%`,
    `traffic,avg_roas,${report.traffic.avgRoas}`,
    `traffic,spend_cents,${report.traffic.totalSpendCents}`,
    `traffic,revenue_cents,${report.traffic.totalRevenueCents}`,
    `traffic,campaigns,${report.traffic.campaignCount}`,
    `retention,active_flows,${report.retention.activeFlows}`,
    `retention,sent_30d,${report.retention.sent30d}`,
    `retention,recovered_30d,${report.retention.recovered30d}`,
    `retention,customers,${report.retention.customerCount}`,
    `billing,mrr_cents,${report.billing.mrrCents}`,
    `billing,orders_processed,${report.billing.ordersProcessed}`,
    `billing,overage_cents,${report.billing.overageCents}`,
    `fiscal,nfe_authorized_30d,${report.fiscal.nfeAuthorized30d}`,
  ];
  return lines.join("\n");
}
