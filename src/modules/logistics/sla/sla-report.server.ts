import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SlaReportRow {
  dimension: string;
  dimensionValue: string;
  total: number;
  dispatchedOnTime: number;
  breached: number;
  compliancePercent: number;
  avgHoursToDispatch: number | null;
}

function monthRange(month?: string): { start: string; end: string } {
  const ref = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function aggregateRows(
  dimension: string,
  orders: Array<{
    channel: string;
    carrier: string | null;
    city: string | null;
    sla_breached: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
  }>,
  keyFn: (o: (typeof orders)[0]) => string,
): SlaReportRow[] {
  const map = new Map<
    string,
    { total: number; onTime: number; breached: number; dispatchHours: number[] }
  >();

  for (const o of orders) {
    const key = keyFn(o) || "—";
    const entry = map.get(key) ?? { total: 0, onTime: 0, breached: 0, dispatchHours: [] };
    entry.total += 1;
    if (o.sla_breached) entry.breached += 1;
    const meta = o.metadata ?? {};
    if (meta.sla_met === true) entry.onTime += 1;
    if (meta.sla_dispatched_at && o.created_at) {
      const hours =
        (new Date(meta.sla_dispatched_at as string).getTime() -
          new Date(o.created_at).getTime()) /
        3_600_000;
      if (hours >= 0) entry.dispatchHours.push(hours);
    }
    map.set(key, entry);
  }

  return [...map.entries()].map(([value, stats]) => ({
    dimension,
    dimensionValue: value,
    total: stats.total,
    dispatchedOnTime: stats.onTime,
    breached: stats.breached,
    compliancePercent:
      stats.total > 0
        ? Math.round(((stats.total - stats.breached) / stats.total) * 100)
        : 100,
    avgHoursToDispatch:
      stats.dispatchHours.length > 0
        ? Math.round(
            (stats.dispatchHours.reduce((s, h) => s + h, 0) / stats.dispatchHours.length) * 10,
          ) / 10
        : null,
  }));
}

export async function buildSlaMonthlyReport(
  clientId: string,
  month?: string,
): Promise<{
  month: string;
  byChannel: SlaReportRow[];
  byCarrier: SlaReportRow[];
  byRegion: SlaReportRow[];
}> {
  const { start, end } = monthRange(month);
  const monthLabel = start.slice(0, 7);

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("channel, carrier, city, sla_breached, metadata, created_at")
    .eq("client_id", clientId)
    .gte("created_at", start)
    .lt("created_at", end)
    .not("sla_deadline_at", "is", null);

  if (error) throw new Error(error.message);

  const rows = (orders ?? []).map((o) => ({
    channel: o.channel as string,
    carrier: o.carrier as string | null,
    city: o.city as string | null,
    sla_breached: o.sla_breached as boolean,
    metadata: (o.metadata ?? {}) as Record<string, unknown>,
    created_at: o.created_at as string,
  }));

  return {
    month: monthLabel,
    byChannel: aggregateRows("channel", rows, (o) => o.channel),
    byCarrier: aggregateRows("carrier", rows, (o) => o.carrier ?? "—"),
    byRegion: aggregateRows("region", rows, (o) => o.city ?? "—"),
  };
}

export async function exportSlaReportCsv(clientId: string, month?: string): Promise<string> {
  const report = await buildSlaMonthlyReport(clientId, month);
  const header = "dimension,value,total,on_time,breached,compliance_pct,avg_hours_dispatch\n";
  const all = [...report.byChannel, ...report.byCarrier, ...report.byRegion];
  const rows = all
    .map((r) =>
      [
        r.dimension,
        r.dimensionValue,
        r.total,
        r.dispatchedOnTime,
        r.breached,
        r.compliancePercent,
        r.avgHoursToDispatch ?? "",
      ].join(","),
    )
    .join("\n");
  return header + rows;
}

export async function runMonthlySlaReportJob(): Promise<{ clients: number; alerts: number }> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("status", "active");

  let alerts = 0;
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const month = prevMonth.toISOString().slice(0, 7);

  for (const c of clients ?? []) {
    const report = await buildSlaMonthlyReport(c.id as string, month);
    const totalBreached = report.byChannel.reduce((s, r) => s + r.breached, 0);
    const totalOrders = report.byChannel.reduce((s, r) => s + r.total, 0);
    if (totalOrders === 0) continue;

    const compliance = Math.round(((totalOrders - totalBreached) / totalOrders) * 100);
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: c.id,
      kind: "sla",
      severity: compliance < 80 ? "warning" : "info",
      title: `Relatório SLA ${month}`,
      message: `${c.name}: ${compliance}% compliance · ${totalBreached} estouro(s) em ${totalOrders} pedidos`,
      is_resolved: false,
    });
    alerts += 1;
  }

  return { clients: clients?.length ?? 0, alerts };
}
