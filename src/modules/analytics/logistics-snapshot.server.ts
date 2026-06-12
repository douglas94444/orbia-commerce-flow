import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFulfillmentBillingSummary } from "@/modules/billing/fulfillment-billing.server";
import { getLogisticsAnalytics } from "@/modules/logistics/analytics/logistics-analytics.server";
import { getSlaDashboard } from "@/modules/logistics/sla/sla-engine.server";

export interface LogisticsSnapshot {
  slaCompliancePercent: number;
  pickingAccuracyPercent: number;
  incidentRatePercent: number;
  avgShippingCostCents: number;
  fulfillmentOrdersMonth: number;
}

const EMPTY_SNAPSHOT: LogisticsSnapshot = {
  slaCompliancePercent: 100,
  pickingAccuracyPercent: 100,
  incidentRatePercent: 0,
  avgShippingCostCents: 0,
  fulfillmentOrdersMonth: 0,
};

export async function getClientLogisticsSnapshot(clientId: string): Promise<LogisticsSnapshot> {
  const [analytics, sla, billing] = await Promise.all([
    getLogisticsAnalytics(clientId),
    getSlaDashboard(clientId),
    getFulfillmentBillingSummary(clientId),
  ]);

  return {
    slaCompliancePercent: sla.compliancePercent,
    pickingAccuracyPercent: analytics.pickingAccuracyPercent,
    incidentRatePercent: analytics.incidentRatePercent,
    avgShippingCostCents: analytics.avgShippingCostCents,
    fulfillmentOrdersMonth: billing.ordersProcessed,
  };
}

export async function getPortfolioLogisticsSnapshot(): Promise<LogisticsSnapshot> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  if (!clients?.length) return EMPTY_SNAPSHOT;

  let slaSum = 0;
  let slaCount = 0;
  let pickingSum = 0;
  let incidentSum = 0;
  let shippingSum = 0;
  let shippingCount = 0;
  let fulfillmentOrders = 0;

  for (const c of clients) {
    const snap = await getClientLogisticsSnapshot(c.id as string);
    if (snap.slaCompliancePercent > 0) {
      slaSum += snap.slaCompliancePercent;
      slaCount += 1;
    }
    pickingSum += snap.pickingAccuracyPercent;
    incidentSum += snap.incidentRatePercent;
    if (snap.avgShippingCostCents > 0) {
      shippingSum += snap.avgShippingCostCents;
      shippingCount += 1;
    }
    fulfillmentOrders += snap.fulfillmentOrdersMonth;
  }

  const n = clients.length;
  return {
    slaCompliancePercent: slaCount > 0 ? Math.round(slaSum / slaCount) : 100,
    pickingAccuracyPercent: Math.round(pickingSum / n),
    incidentRatePercent: Math.round((incidentSum / n) * 10) / 10,
    avgShippingCostCents: shippingCount > 0 ? Math.round(shippingSum / shippingCount) : 0,
    fulfillmentOrdersMonth: fulfillmentOrders,
  };
}
