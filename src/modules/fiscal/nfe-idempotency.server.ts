import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ExistingEmission {
  id: string;
  status: string;
  external_ref: string | null;
}

export async function findActiveNfeEmissionForOrder(
  orderId: string,
): Promise<ExistingEmission | null> {
  const { data } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, status, external_ref")
    .eq("order_id", orderId)
    .eq("type", "NF-e")
    .in("status", ["pendente", "autorizada"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as ExistingEmission | null;
}

export async function resolveOrCreateNfeEmission(input: {
  clientId: string;
  orderId: string;
  externalRef: string;
  valueCents: number;
}): Promise<{ id: string; isNew: boolean; externalRef: string }> {
  const existing = await findActiveNfeEmissionForOrder(input.orderId);
  if (existing) {
    return { id: existing.id, isNew: false, externalRef: existing.external_ref ?? input.externalRef };
  }

  const { data, error } = await supabaseAdmin
    .from("nfe_emissions")
    .insert({
      client_id: input.clientId,
      order_id: input.orderId,
      external_ref: input.externalRef,
      type: "NF-e",
      status: "pendente",
      value_cents: input.valueCents,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const retry = await findActiveNfeEmissionForOrder(input.orderId);
      if (retry) {
        return { id: retry.id, isNew: false, externalRef: retry.external_ref ?? input.externalRef };
      }
    }
    throw new Error(`Failed to create nfe_emissions row: ${error.message}`);
  }

  return { id: data.id as string, isNew: true, externalRef: input.externalRef };
}

export async function markOrderNfRejected(orderId: string, message: string): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("metadata")
    .eq("id", orderId)
    .single();

  const meta = (order?.metadata ?? {}) as Record<string, unknown>;
  await supabaseAdmin
    .from("orders")
    .update({
      nf_status: "rejeitada",
      metadata: { ...meta, last_nfe_error: message },
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}
