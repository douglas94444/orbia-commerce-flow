import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OperationAlert } from "@/shared/types/orbia";
import { generateClientInsights, generatePortfolioInsights } from "./ai-insights.server";
import type { AiInsight } from "./ai-insights.server";

export interface CohortRow {
  cohort: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
}

export interface LtvCohortRow {
  cohort: string;
  customers: number;
  avgLtv: number;
}

export interface PortfolioLogisticsMetrics {
  slaCompliancePercent: number;
  pickingAccuracyPercent: number;
  incidentRatePercent: number;
  avgShippingCostCents: number;
  fulfillmentOrdersMonth: number;
}

export interface PortfolioAnalytics {
  gmv30d: number;
  avgRoas: number;
  nfeEmitted: number;
  slaPercent: number;
  marginPercent: number;
  adSpend30d: number;
  gmvRoasSeries: Array<{ day: string; gmv: number; roas: number }>;
  channelRoas: Array<{ channel: string; roas: number }>;
  cohortRetention: CohortRow[];
  ltvByCohort: LtvCohortRow[];
  logistics: PortfolioLogisticsMetrics;
}

async function computePortfolioAnalytics(context: {
  userId: string;
  supabase: import("@supabase/supabase-js").SupabaseClient;
}): Promise<PortfolioAnalytics> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [ordersResult, campaignsResult, nfeResult, customersResult] = await Promise.all([
      context.supabase
        .from("orders")
        .select("value_cents, created_at, status, channel, metadata")
        .gte("created_at", thirtyDaysAgo),
      context.supabase.from("campaigns").select("platform, spend_cents, revenue_cents, roas"),
      context.supabase
        .from("nfe_emissions")
        .select("id")
        .eq("status", "autorizada")
        .gte("created_at", thirtyDaysAgo),
      context.supabase
        .from("customers")
        .select("ltv_cents, created_at, last_order_at"),
    ]);

    const orders = ordersResult.data ?? [];
    const campaigns = campaignsResult.data ?? [];
    const nfeEmitted = nfeResult.data?.length ?? 0;

    const gmv30d = orders.reduce((sum, o) => sum + (o.value_cents ?? 0), 0) / 100;

    const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend_cents ?? 0), 0);
    const adSpend30d = totalSpend / 100;
    const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue_cents ?? 0), 0);
    const marginPercent =
      gmv30d > 0
        ? Math.round(((gmv30d - adSpend30d) / gmv30d) * 1000) / 10
        : 0;
    const avgRoas =
      totalSpend > 0
        ? Math.round((totalRevenue / totalSpend) * 10) / 10
        : campaigns.length > 0
          ? Math.round(
              (campaigns.reduce((s, c) => s + Number(c.roas ?? 0), 0) / campaigns.length) * 10,
            ) / 10
          : 0;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("id", context.userId)
      .single();
    const isStaff =
      profile && ["orbia_admin", "orbia_staff"].includes(profile.role as string);

    const { data: membership } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();

    const {
      getClientLogisticsSnapshot,
      getPortfolioLogisticsSnapshot,
    } = await import("./logistics-snapshot.server");

    const logistics = isStaff
      ? await getPortfolioLogisticsSnapshot()
      : membership?.client_id
        ? await getClientLogisticsSnapshot(membership.client_id as string)
        : {
            slaCompliancePercent: 100,
            pickingAccuracyPercent: 100,
            incidentRatePercent: 0,
            avgShippingCostCents: 0,
            fulfillmentOrdersMonth: 0,
          };

    const slaPercent = logistics.slaCompliancePercent;

    const gmvByDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      gmvByDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const o of orders) {
      const day = o.created_at.slice(0, 10);
      if (gmvByDay.has(day)) {
        gmvByDay.set(day, (gmvByDay.get(day) ?? 0) + (o.value_cents ?? 0) / 100);
      }
    }

    const dailySpendBrl = adSpend30d / 30;
    const gmvRoasSeries = Array.from(gmvByDay.entries()).map(([day, gmv], i) => ({
      day: String(i + 1),
      gmv: Math.round(gmv),
      roas:
        dailySpendBrl > 0 ? Math.round((gmv / dailySpendBrl) * 10) / 10 : 0,
    }));

    const channelMap = new Map<string, { spend: number; revenue: number }>();
    for (const c of campaigns) {
      const ch =
        c.platform === "meta" ? "Meta Ads" : c.platform === "google" ? "Google Ads" : c.platform;
      const cur = channelMap.get(ch) ?? { spend: 0, revenue: 0 };
      cur.spend += Number(c.spend_cents ?? 0);
      cur.revenue += Number(c.revenue_cents ?? 0);
      channelMap.set(ch, cur);
    }

    const orderChannels = new Map<string, number>();
    for (const o of orders) {
      const label =
        o.channel === "nuvemshop" ? "Nuvemshop" : o.channel === "shopify" ? "Shopify" : o.channel;
      orderChannels.set(label, (orderChannels.get(label) ?? 0) + (o.value_cents ?? 0));
    }

    const channelRoas: Array<{ channel: string; roas: number }> = [];
    for (const [channel, { spend, revenue }] of channelMap) {
      channelRoas.push({
        channel,
        roas: spend > 0 ? Math.round((revenue / spend) * 10) / 10 : 0,
      });
    }
    if (channelRoas.length === 0) {
      for (const [channel, gmv] of orderChannels) {
        channelRoas.push({ channel, roas: gmv > 0 ? avgRoas || 1 : 0 });
      }
    }

    const cohortRetention = buildCohortRetention(orders);
    const ltvByCohort = buildLtvByCohortFromCustomers(customersResult.data ?? [], orders);

    return {
      gmv30d,
      avgRoas,
      nfeEmitted,
      slaPercent,
      marginPercent,
      adSpend30d,
      gmvRoasSeries,
      channelRoas,
      cohortRetention,
      ltvByCohort,
      logistics,
    };
}

export const getPortfolioAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => computePortfolioAnalytics(context));

function customerKeyFromOrder(order: { metadata?: unknown }): string | null {
  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const email = meta.customer_email as string | undefined;
  const phone = meta.customer_phone as string | undefined;
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  return null;
}

function buildLtvByCohortFromCustomers(
  customers: Array<{ ltv_cents: number; created_at: string; last_order_at: string | null }>,
  orders: Array<{ created_at: string; metadata?: unknown }>,
): LtvCohortRow[] {
  const firstOrderMonth = new Map<string, string>();
  for (const o of orders) {
    const key = customerKeyFromOrder(o);
    if (!key) continue;
    const month = o.created_at.slice(0, 7);
    const existing = firstOrderMonth.get(key);
    if (!existing || month < existing) firstOrderMonth.set(key, month);
  }

  const map = new Map<string, { total: number; count: number }>();
  for (const c of customers) {
    const cohort = (c.last_order_at ?? c.created_at).slice(0, 7);
    const cur = map.get(cohort) ?? { total: 0, count: 0 };
    cur.total += c.ltv_cents ?? 0;
    cur.count += 1;
    map.set(cohort, cur);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([cohort, v]) => ({
      cohort,
      customers: v.count,
      avgLtv: v.count > 0 ? Math.round(v.total / v.count / 100) : 0,
    }));
}

function buildCohortRetention(
  orders: Array<{ created_at: string; metadata?: unknown }>,
): CohortRow[] {
  const byCustomerMonth = new Map<string, Set<string>>();

  for (const o of orders) {
    const key = customerKeyFromOrder(o);
    if (!key) continue;
    const month = o.created_at.slice(0, 7);
    if (!byCustomerMonth.has(key)) byCustomerMonth.set(key, new Set());
    byCustomerMonth.get(key)!.add(month);
  }

  const cohorts = new Map<string, string[]>();
  for (const [customerKey, months] of byCustomerMonth) {
    const sorted = [...months].sort();
    const first = sorted[0];
    if (!first) continue;
    const list = cohorts.get(first) ?? [];
    list.push(customerKey);
    cohorts.set(first, list);
  }

  const rows: CohortRow[] = [];
  for (const [cohort, customerKeys] of [...cohorts.entries()].slice(-4)) {
    const base = customerKeys.length || 1;
    const countActive = (offset: number) => {
      const target = addMonths(cohort, offset);
      return customerKeys.filter((id) => byCustomerMonth.get(id)?.has(target)).length;
    };
    rows.push({
      cohort,
      month0: 100,
      month1: Math.round((countActive(1) / base) * 100),
      month2: Math.round((countActive(2) / base) * 100),
      month3: Math.round((countActive(3) / base) * 100),
    });
  }
  return rows;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const getNfeCount30d = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await context.supabase
      .from("nfe_emissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "autorizada")
      .gte("created_at", thirtyDaysAgo);
    return count ?? 0;
  });

export const listOperationAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OperationAlert[]> => {
    const { data, error } = await context.supabase
      .from("operation_alerts")
      .select("id, kind, severity, title, message, created_at, clients(name)")
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    return (data ?? []).map(
      (row: {
        id: string;
        kind: string;
        severity: string;
        title: string;
        message: string;
        created_at: string;
        clients: { name: string } | null;
      }): OperationAlert => ({
        id: row.id,
        kind: row.kind as OperationAlert["kind"],
        severity: row.severity as OperationAlert["severity"],
        title: row.title,
        message: row.message,
        client: row.clients?.name ?? "—",
        time: new Date(row.created_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    );
  });

export const getMonthlyReportHtml = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: membership } = await context.supabase
      .from("client_members")
      .select("client_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();

    const clientId = data.clientId ?? (membership?.client_id as string | undefined);
    if (!clientId) throw new Error("Cliente não identificado");

    const { buildMonthlyReportHtml } = await import("./monthly-report.server");
    return { html: await buildMonthlyReportHtml(clientId) };
  });

export const exportPortfolioAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const data = await computePortfolioAnalytics(context);
    const { exportPortfolioAnalyticsCsv } = await import("./export-portfolio-analytics.server");
    return { csv: exportPortfolioAnalyticsCsv(data) };
  });

export const getClientAiInsights = createServerFn({ method: "POST" })
  .inputValidator(z.object({ clientId: z.string().uuid().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }): Promise<AiInsight[]> => {
    if (!data.clientId) return generatePortfolioInsights();
    return generateClientInsights(data.clientId);
  });

export { type AiInsight };
