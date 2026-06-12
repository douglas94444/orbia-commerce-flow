import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFulfillmentBillingSummary } from "@/modules/billing/fulfillment-billing.server";
import { getLogisticsAnalytics } from "./logistics-analytics.server";
import { getSlaDashboard } from "../sla/sla-engine.server";
import { buildSlaMonthlyReport } from "../sla/sla-report.server";

export interface ClientLogisticsReport {
  clientId: string;
  analytics: Awaited<ReturnType<typeof getLogisticsAnalytics>>;
  sla: Awaited<ReturnType<typeof getSlaDashboard>>;
  billing: Awaited<ReturnType<typeof getFulfillmentBillingSummary>>;
  slaMonth: string;
  slaByChannel: Awaited<ReturnType<typeof buildSlaMonthlyReport>>["byChannel"];
}

export async function buildClientLogisticsReport(clientId: string): Promise<ClientLogisticsReport> {
  const month = new Date().toISOString().slice(0, 7);
  const [analytics, sla, billing, slaReport] = await Promise.all([
    getLogisticsAnalytics(clientId),
    getSlaDashboard(clientId),
    getFulfillmentBillingSummary(clientId),
    buildSlaMonthlyReport(clientId, month),
  ]);

  return {
    clientId,
    analytics,
    sla,
    billing,
    slaMonth: month,
    slaByChannel: slaReport.byChannel,
  };
}

export async function exportClientLogisticsQbrCsv(clientId: string): Promise<string> {
  const report = await buildClientLogisticsReport(clientId);
  const lines = [
    "section,metric,value",
    `analytics,avg_shipping_cost_cents,${report.analytics.avgShippingCostCents}`,
    `analytics,on_time_delivery_pct,${report.analytics.onTimeDeliveryPercent}`,
    `analytics,picking_accuracy_pct,${report.analytics.pickingAccuracyPercent}`,
    `analytics,incident_rate_pct,${report.analytics.incidentRatePercent}`,
    `sla,compliance_pct,${report.sla.compliancePercent}`,
    `sla,at_risk,${report.sla.atRisk}`,
    `sla,breached,${report.sla.breached}`,
    `billing,orders_processed,${report.billing.ordersProcessed}`,
    `billing,included,${report.billing.included}`,
    `billing,overage_orders,${report.billing.overageOrders}`,
    `billing,overage_cents,${report.billing.overageCents}`,
    `billing,picks,${report.billing.picksCompleted}`,
    `billing,packs,${report.billing.packsCompleted}`,
    `billing,returns,${report.billing.returnsHandled}`,
  ];

  for (const row of report.slaByChannel) {
    lines.push(
      `sla_channel,${row.dimensionValue},${row.compliancePercent}% (${row.total} pedidos)`,
    );
  }

  return lines.join("\n");
}

export interface PortfolioFulfillmentStats {
  totalOrdersMonth: number;
  totalOverageOrders: number;
  totalOverageCents: number;
  clientsWithOverage: number;
  avgSlaCompliance: number;
}

export async function getPortfolioFulfillmentStats(): Promise<PortfolioFulfillmentStats> {
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  let totalOrdersMonth = 0;
  let totalOverageOrders = 0;
  let totalOverageCents = 0;
  let clientsWithOverage = 0;
  let slaSum = 0;
  let slaCount = 0;

  for (const c of clients ?? []) {
    const summary = await getFulfillmentBillingSummary(c.id as string, month);
    totalOrdersMonth += summary.ordersProcessed;
    totalOverageOrders += summary.overageOrders;
    totalOverageCents += summary.overageCents;
    if (summary.overageOrders > 0) clientsWithOverage += 1;

    const sla = await getSlaDashboard(c.id as string);
    if (sla.total > 0) {
      slaSum += sla.compliancePercent;
      slaCount += 1;
    }
  }

  return {
    totalOrdersMonth,
    totalOverageOrders,
    totalOverageCents,
    clientsWithOverage,
    avgSlaCompliance: slaCount > 0 ? Math.round(slaSum / slaCount) : 100,
  };
}
