import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Campaign } from "@/shared/types/orbia";
import {
  syncMetaCampaigns as syncMetaCampaignsInternal,
  syncAllMetaCampaigns as syncAllMetaCampaignsInternal,
  syncAllGoogleCampaigns as syncAllGoogleCampaignsInternal,
} from "./sync-campaigns.server";

const PLATFORM_LABEL: Record<string, "Meta Ads" | "Google Ads"> = {
  meta: "Meta Ads",
  google: "Google Ads",
};

// ─── listCampaigns ────────────────────────────────────────────

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Campaign[]> => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select(
        "id, name, platform, status, spend_cents, revenue_cents, attributed_revenue_cents, roas, clients(name)",
      )
      .order("roas", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map(
      (row: {
        id: string;
        name: string;
        platform: string;
        status: string;
        spend_cents: number;
        revenue_cents: number;
        attributed_revenue_cents: number;
        roas: number;
        clients: { name: string } | null;
      }): Campaign => {
        const spend = row.spend_cents;
        const platformRevenue = row.revenue_cents;
        const attributedRevenue = row.attributed_revenue_cents ?? 0;
        const attributedRoas = spend > 0 ? Number((attributedRevenue / spend).toFixed(2)) : 0;
        const revenueDivergencePct =
          platformRevenue > 0
            ? Math.round(
                (Math.abs(attributedRevenue - platformRevenue) / platformRevenue) * 1000,
              ) / 10
            : 0;

        return {
          id: row.id,
          name: row.name,
          client: row.clients?.name ?? "—",
          platform: PLATFORM_LABEL[row.platform] ?? "Meta Ads",
          status: row.status as Campaign["status"],
          spend: Math.round(spend / 100),
          revenue: Math.round(platformRevenue / 100),
          attributedRevenue: Math.round(attributedRevenue / 100),
          roas: Number(row.roas),
          attributedRoas,
          revenueDivergencePct,
        };
      },
    );
  });

// ─── getTrafficStats ──────────────────────────────────────────

export interface TrafficStats {
  avgRoas: number;
  avgAttributedRoas: number;
  totalSpend: number; // in BRL
  totalRevenue: number; // in BRL
  totalAttributedRevenue: number; // in BRL
  campaignCount: number;
  atRisk: number; // ROAS < 4
  highDivergence: number;
  channelRoas: Array<{ channel: string; roas: number }>;
}

export const getTrafficStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrafficStats> => {
    const { data } = await context.supabase
      .from("campaigns")
      .select("platform, spend_cents, revenue_cents, attributed_revenue_cents, roas, status");

    const rows = data ?? [];
    const total = rows.length;
    const totalSpend = Math.round(
      rows.reduce((s: number, r: { spend_cents: number }) => s + r.spend_cents, 0) / 100,
    );
    const totalRevenue = Math.round(
      rows.reduce((s: number, r: { revenue_cents: number }) => s + r.revenue_cents, 0) / 100,
    );
    const totalAttributedRevenue = Math.round(
      rows.reduce(
        (s: number, r: { attributed_revenue_cents?: number }) =>
          s + (r.attributed_revenue_cents ?? 0),
        0,
      ) / 100,
    );
    const avgRoas =
      total > 0
        ? Number(
            (
              rows.reduce((s: number, r: { roas: number }) => s + Number(r.roas), 0) / total
            ).toFixed(1),
          )
        : 0;
    const totalSpendCents = rows.reduce(
      (s: number, r: { spend_cents: number }) => s + r.spend_cents,
      0,
    );
    const totalAttributedCents = rows.reduce(
      (s: number, r: { attributed_revenue_cents?: number }) =>
        s + (r.attributed_revenue_cents ?? 0),
      0,
    );
    const avgAttributedRoas =
      totalSpendCents > 0
        ? Number((totalAttributedCents / totalSpendCents).toFixed(1))
        : 0;
    const atRisk = rows.filter((r: { roas: number }) => Number(r.roas) < 4).length;
    const highDivergence = rows.filter((r: { revenue_cents: number; attributed_revenue_cents?: number }) => {
      const platform = r.revenue_cents;
      const attributed = r.attributed_revenue_cents ?? 0;
      if (platform <= 0 || attributed <= 0) return false;
      return Math.abs(attributed - platform) / platform > 0.2;
    }).length;

    const channelMap = new Map<string, { spend: number; revenue: number }>();
    for (const row of rows) {
      const platform = (row as { platform: string }).platform;
      const ch =
        platform === "meta" ? "Meta Ads" : platform === "google" ? "Google Ads" : platform;
      const cur = channelMap.get(ch) ?? { spend: 0, revenue: 0 };
      cur.spend += Number((row as { spend_cents: number }).spend_cents ?? 0);
      cur.revenue += Number((row as { revenue_cents: number }).revenue_cents ?? 0);
      channelMap.set(ch, cur);
    }

    const channelRoas = [...channelMap.entries()].map(([channel, { spend, revenue }]) => ({
      channel,
      roas: spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0,
    }));

    return {
      avgRoas,
      avgAttributedRoas,
      totalSpend,
      totalRevenue,
      totalAttributedRevenue,
      campaignCount: total,
      atRisk,
      highDivergence,
      channelRoas,
    };
  });

// ─── syncMetaCampaigns ────────────────────────────────────────

async function requireStaffTraffic(
  userId: string,
  supabase: {
    from: (table: string) => ReturnType<import("@supabase/supabase-js").SupabaseClient["from"]>;
  },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
    throw new Error("Apenas equipe Orbia pode sincronizar campanhas.");
  }
}

const syncMetaSchema = z.object({ clientId: z.string().uuid() });

export const syncMetaCampaigns = createServerFn({ method: "POST" })
  .inputValidator(syncMetaSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await requireStaffTraffic(context.userId, context.supabase);
    return syncMetaCampaignsInternal(data.clientId);
  });

export const syncAllMetaCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaffTraffic(context.userId, context.supabase);
    return syncAllMetaCampaignsInternal();
  });

export const syncAllGoogleCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaffTraffic(context.userId, context.supabase);
    return syncAllGoogleCampaignsInternal();
  });
