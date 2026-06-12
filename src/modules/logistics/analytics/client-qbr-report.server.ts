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
