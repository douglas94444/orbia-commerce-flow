import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface MarketplacePenaltyRow {
  id: string;
  orderId: string | null;
  channel: string;
  penaltyType: string;
  amountCents: number;
  description: string | null;
  createdAt: string;
}

export async function listMarketplacePenalties(
  clientId: string,
  days = 90,
): Promise<MarketplacePenaltyRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("marketplace_penalty_records")
    .select("id, order_id, channel, penalty_type, amount_cents, description, created_at")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    orderId: r.order_id as string | null,
    channel: r.channel as string,
    penaltyType: r.penalty_type as string,
    amountCents: r.amount_cents as number,
    description: r.description as string | null,
    createdAt: r.created_at as string,
  }));
}
