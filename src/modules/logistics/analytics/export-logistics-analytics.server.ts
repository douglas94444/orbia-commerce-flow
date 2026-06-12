import { getLogisticsAnalytics } from "./logistics-analytics.server";
import { getStageDurations } from "./stage-duration.server";
import { getShippingCostByCarrier, getMonthlyShippingCosts } from "./shipping-cost-by-carrier.server";
import { getOrdersByChannel } from "./orders-by-channel.server";
import { getOperatorPerformance } from "../ops/operator-performance.server";

export async function exportLogisticsAnalyticsCsv(clientId: string): Promise<string> {
  const [summary, stages, carriers, channels, monthly, operators] = await Promise.all([
    getLogisticsAnalytics(clientId),
    getStageDurations(clientId),
    getShippingCostByCarrier(clientId),
    getOrdersByChannel(clientId),
    getMonthlyShippingCosts(clientId),
    getOperatorPerformance(clientId),
  ]);

  const lines = [
    "section,metric,value",
    `summary,avg_shipping_cost_cents,${summary.avgShippingCostCents}`,
    `summary,on_time_delivery_pct,${summary.onTimeDeliveryPercent}`,
    `summary,picking_accuracy_pct,${summary.pickingAccuracyPercent}`,
    `summary,incident_rate_pct,${summary.incidentRatePercent}`,
    `summary,picks_last_24h,${summary.picksLast24h}`,
    `summary,packs_last_24h,${summary.packsLast24h}`,
    `summary,delivered_count_30d,${summary.deliveredCount}`,
  ];

  for (const s of stages) {
    lines.push(
      `stage,${s.label},median=${s.medianHours}h p95=${s.p95Hours}h n=${s.sampleSize}`,
    );
  }
  for (const c of carriers) {
    lines.push(`carrier,${c.provider},avg=${c.avgCostCents} orders=${c.orderCount}`);
  }
  for (const ch of channels) {
    lines.push(
      `channel,${ch.label},orders=${ch.orderCount} gmv_cents=${ch.gmvCents} sla=${ch.slaCompliancePercent}%`,
    );
  }
  for (const m of monthly) {
    lines.push(`monthly_cost,${m.month},avg=${m.avgCostCents} orders=${m.orderCount}`);
  }
  for (const op of operators) {
    lines.push(
      `operator,${op.operatorName},picks=${op.picksCompleted} packs=${op.packsCompleted} accuracy=${op.accuracyPercent}%`,
    );
  }

  return lines.join("\n");
}
