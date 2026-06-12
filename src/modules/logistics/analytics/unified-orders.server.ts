import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface UnifiedOrderRow {
  id: string;
  externalId: string;
  channel: string;
  status: string;
  valueCents: number;
  customerId: string | null;
  createdAt: string;
  slaDeadlineAt: string | null;
}

export interface UnifiedOrderQueueFilters {
  channel?: string;
  status?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

export async function getUnifiedOrderQueue(
  clientId: string,
  filters: UnifiedOrderQueueFilters = {},
): Promise<{ rows: UnifiedOrderRow[]; total: number }> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = supabaseAdmin
    .from("orders")
    .select(
      "id, external_id, channel, status, value_cents, customer_id, created_at, sla_deadline_at",
      { count: "exact" },
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.since) query = query.gte("created_at", filters.since);

  const { data, count, error } = await query;
  if (error) throw new Error(`Unified order queue failed: ${error.message}`);

  const rows: UnifiedOrderRow[] = (data ?? []).map((o) => ({
    id: o.id as string,
    externalId: o.external_id as string,
    channel: o.channel as string,
    status: o.status as string,
    valueCents: o.value_cents as number,
    customerId: (o.customer_id as string | null) ?? null,
    createdAt: o.created_at as string,
    slaDeadlineAt: (o.sla_deadline_at as string | null) ?? null,
  }));

  return { rows, total: count ?? rows.length };
}

export async function countUnifiedOrdersByStatus(
  clientId: string,
  days = 30,
): Promise<Record<string, number>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabaseAdmin
    .from("orders")
    .select("status")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString());

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const status = row.status as string;
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}
