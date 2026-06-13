import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type FiscalDocType = "nfe" | "nfce" | "nfse";

export async function reserveSeriesNumber(
  clientId: string,
  docType: FiscalDocType,
  environment: string,
  serie = "1",
): Promise<{ serie: string; number: number }> {
  const { data: existing } = await supabaseAdmin
    .from("fiscal_series")
    .select("id, last_number")
    .eq("client_id", clientId)
    .eq("doc_type", docType)
    .eq("serie", serie)
    .eq("environment", environment)
    .maybeSingle();

  if (existing) {
    const next = (existing.last_number ?? 0) + 1;
    await supabaseAdmin
      .from("fiscal_series")
      .update({ last_number: next, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { serie, number: next };
  }

  await supabaseAdmin.from("fiscal_series").insert({
    client_id: clientId,
    doc_type: docType,
    serie,
    last_number: 1,
    environment,
  });

  return { serie, number: 1 };
}

export async function listFiscalSeries(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("fiscal_series")
    .select("id, doc_type, serie, last_number, environment, updated_at")
    .eq("client_id", clientId)
    .order("doc_type");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertFiscalSeries(input: {
  clientId: string;
  docType: FiscalDocType;
  serie: string;
  lastNumber: number;
  environment: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("fiscal_series").upsert(
    {
      client_id: input.clientId,
      doc_type: input.docType,
      serie: input.serie,
      last_number: input.lastNumber,
      environment: input.environment,
    },
    { onConflict: "client_id,doc_type,serie,environment" },
  );
  if (error) throw new Error(error.message);
}
