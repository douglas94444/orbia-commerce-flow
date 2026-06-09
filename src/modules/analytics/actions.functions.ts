import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OperationAlert } from "@/shared/types/orbia";

export interface CohortRow {
  cohort: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
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
}

export const getPortfolioAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortfolioAnalytics> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [ordersResult, campaignsResult, nfeResult] = await Promise.all([
      context.supabase
        .from("orders")
        .select("client_id, value_cents, created_at, status, channel")
        .gte("created_at", thirtyDaysAgo),
      context.supabase.from("campaigns").select("platform, spend_cents, revenue_cents, roas"),
      context.supabase
        .from("nfe_emissions")
        .select("id")
        .eq("status", "autorizada")
        .gte("created_at", thirtyDaysAgo),
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

    const delivered = orders.filter((o) => o.status === "entregue").length;
    const slaPercent = orders.length > 0 ? Math.round((delivered / orders.length) * 1000) / 10 : 0;

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

    const gmvRoasSeries = Array.from(gmvByDay.entries()).map(([day, gmv], i) => ({
      day: String(i + 1),
      gmv: Math.round(gmv),
      roas: avgRoas,
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
    };
  });

function buildCohortRetention(
  orders: Array<{ client_id?: string; created_at: string; value_cents: number | null }>,
): CohortRow[] {
  const byClientMonth = new Map<string, Set<string>>();

  for (const o of orders) {
    const clientId = (o as { client_id?: string }).client_id;
    if (!clientId) continue;
    const month = o.created_at.slice(0, 7);
    const key = clientId;
    if (!byClientMonth.has(key)) byClientMonth.set(key, new Set());
    byClientMonth.get(key)!.add(month);
  }

  const cohorts = new Map<string, string[]>();
  for (const [clientId, months] of byClientMonth) {
    const sorted = [...months].sort();
    const first = sorted[0];
    if (!first) continue;
    const list = cohorts.get(first) ?? [];
    list.push(clientId);
    cohorts.set(first, list);
  }

  const rows: CohortRow[] = [];
  for (const [cohort, clientIds] of [...cohorts.entries()].slice(-4)) {
    const base = clientIds.length || 1;
    const countActive = (offset: number) => {
      const target = addMonths(cohort, offset);
      return clientIds.filter((id) => byClientMonth.get(id)?.has(target)).length;
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
