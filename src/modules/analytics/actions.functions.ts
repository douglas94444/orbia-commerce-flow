import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PortfolioAnalytics {
  gmv30d: number;
  avgRoas: number;
  nfeEmitted: number;
  slaPercent: number;
  gmvRoasSeries: Array<{ day: string; gmv: number; roas: number }>;
  channelRoas: Array<{ channel: string; roas: number }>;
}

export const getPortfolioAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortfolioAnalytics> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [ordersResult, campaignsResult, nfeResult] = await Promise.all([
      context.supabase
        .from("orders")
        .select("value_cents, created_at, status, channel")
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
    const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue_cents ?? 0), 0);
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

    return { gmv30d, avgRoas, nfeEmitted, slaPercent, gmvRoasSeries, channelRoas };
  });

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
