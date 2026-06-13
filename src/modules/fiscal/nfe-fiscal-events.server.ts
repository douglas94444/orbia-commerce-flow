import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NfeFiscalEventType = "cancelamento" | "carta_correcao" | "inutilizacao";

export async function recordNfeFiscalEvent(input: {
  clientId: string;
  nfeEmissionId?: string | null;
  eventType: NfeFiscalEventType;
  description?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("nfe_fiscal_events").insert({
    client_id: input.clientId,
    nfe_emission_id: input.nfeEmissionId ?? null,
    event_type: input.eventType,
    description: input.description ?? null,
    payload: input.payload ?? {},
  });
}

export async function listNfeFiscalEvents(
  nfeEmissionId: string,
): Promise<
  Array<{
    id: string;
    eventType: string;
    description: string | null;
    createdAt: string;
    payload: Record<string, unknown>;
  }>
> {
  const { data } = await supabaseAdmin
    .from("nfe_fiscal_events")
    .select("id, event_type, description, created_at, payload")
    .eq("nfe_emission_id", nfeEmissionId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    eventType: r.event_type as string,
    description: r.description as string | null,
    createdAt: r.created_at as string,
    payload: (r.payload as Record<string, unknown>) ?? {},
  }));
}
