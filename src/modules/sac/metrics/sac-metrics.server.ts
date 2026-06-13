import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SacMetricsSummary {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgTmrMinutes: number | null;
  avgTmaMinutes: number | null;
  slaMetPercent: number;
  fcrPercent: number;
  csatAvg: number | null;
  byChannel: Array<{ channel: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  negativeSentiment: number;
}

export async function getSacMetricsSummary(
  clientId: string,
  days: number,
): Promise<SacMetricsSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();

  const { data: tickets } = await supabaseAdmin
    .from("sac_tickets")
    .select(
      "id, channel, category, status, first_response_at, resolved_at, created_at, sla_response_due_at",
    )
    .eq("client_id", clientId)
    .gte("created_at", since);

  const rows = tickets ?? [];
  const total = rows.length;
  const open = rows.filter((t) => !["closed", "merged", "resolved"].includes(t.status)).length;
  const resolved = rows.filter((t) => ["closed", "resolved"].includes(t.status)).length;

  const tmrValues = rows
    .filter((t) => t.first_response_at)
    .map(
      (t) =>
        (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 60_000,
    );
  const tmaValues = rows
    .filter((t) => t.resolved_at)
    .map(
      (t) => (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 60_000,
    );

  const slaEligible = rows.filter((t) => t.first_response_at && t.sla_response_due_at);
  const slaMet = slaEligible.filter(
    (t) => new Date(t.first_response_at!) <= new Date(t.sla_response_due_at!),
  ).length;

  const ticketIds = rows.map((t) => t.id);
  const { data: csat } = ticketIds.length
    ? await supabaseAdmin
        .from("sac_csat_surveys")
        .select("score")
        .eq("client_id", clientId)
        .in("ticket_id", ticketIds)
        .not("score", "is", null)
    : { data: [] };

  const csatScores = (csat ?? []).map((c) => c.score as number);
  const csatAvg =
    csatScores.length > 0
      ? csatScores.reduce((s, v) => s + v, 0) / csatScores.length
      : null;

  const channelMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  for (const t of rows) {
    channelMap.set(t.channel, (channelMap.get(t.channel) ?? 0) + 1);
    categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1);
  }

  const { count: negSentiment } = ticketIds.length
    ? await supabaseAdmin
        .from("sac_sentiment_scores")
        .select("id", { count: "exact", head: true })
        .in("ticket_id", ticketIds)
        .eq("sentiment", "negative")
    : { count: 0 };

  const fcr = resolved > 0 ? Math.round((resolved / total) * 100) : 0;

  return {
    totalTickets: total,
    openTickets: open,
    resolvedTickets: resolved,
    avgTmrMinutes: tmrValues.length
      ? Math.round(tmrValues.reduce((s, v) => s + v, 0) / tmrValues.length)
      : null,
    avgTmaMinutes: tmaValues.length
      ? Math.round(tmaValues.reduce((s, v) => s + v, 0) / tmaValues.length)
      : null,
    slaMetPercent: slaEligible.length
      ? Math.round((slaMet / slaEligible.length) * 100)
      : 100,
    fcrPercent: fcr,
    csatAvg: csatAvg ? Number(csatAvg.toFixed(2)) : null,
    byChannel: Array.from(channelMap.entries()).map(([channel, count]) => ({ channel, count })),
    byCategory: Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count })),
    negativeSentiment: negSentiment ?? 0,
  };
}
