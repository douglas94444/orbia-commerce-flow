import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface DispatchQueueRow {
  orderId: string;
  externalId: string;
  channel: string;
  weightKg: number | null;
  labelUrl: string | null;
  createdAt: string;
}

export async function listDispatchQueue(clientId: string): Promise<DispatchQueueRow[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, external_id, channel, metadata, created_at")
    .eq("client_id", clientId)
    .eq("status", "em_packing")
    .eq("nf_status", "autorizada")
    .order("created_at")
    .limit(100);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      orderId: row.id as string,
      externalId: row.external_id as string,
      channel: row.channel as string,
      weightKg: (meta.packing_weight_kg as number | undefined) ?? null,
      labelUrl: (meta.label_url as string | undefined) ?? null,
      createdAt: row.created_at as string,
    };
  });
}
