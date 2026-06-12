import type { PortfolioAnalytics } from "./actions.functions";

export function exportPortfolioAnalyticsCsv(data: PortfolioAnalytics): string {
  const lines = [
    "section,metric,value",
    `kpi,gmv_30d_brl,${data.gmv30d}`,
    `kpi,avg_roas,${data.avgRoas}`,
    `kpi,nfe_emitted,${data.nfeEmitted}`,
    `kpi,sla_percent,${data.slaPercent}`,
    `kpi,margin_percent,${data.marginPercent}`,
    `kpi,ad_spend_30d_brl,${data.adSpend30d}`,
    `logistics,sla_compliance,${data.logistics.slaCompliancePercent}`,
    `logistics,picking_accuracy,${data.logistics.pickingAccuracyPercent}`,
    `logistics,incident_rate,${data.logistics.incidentRatePercent}`,
    `logistics,avg_shipping_cost_cents,${data.logistics.avgShippingCostCents}`,
    `logistics,fulfillment_orders_month,${data.logistics.fulfillmentOrdersMonth}`,
  ];

  for (const row of data.gmvRoasSeries) {
    lines.push(`daily,day_${row.day},gmv=${row.gmv} roas=${row.roas}`);
  }
  for (const row of data.channelRoas) {
    lines.push(`channel_roas,${row.channel},${row.roas}`);
  }
  for (const row of data.ltvByCohort) {
    lines.push(`ltv_cohort,${row.cohort},avg=${row.avgLtv} customers=${row.customers}`);
  }
  for (const row of data.cohortRetention) {
    lines.push(
      `retention,${row.cohort},m0=${row.month0}% m1=${row.month1}% m2=${row.month2}% m3=${row.month3}%`,
    );
  }

  return lines.join("\n");
}
