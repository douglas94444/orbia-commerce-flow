import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/integrations/claude/client.server";
import { logIntegration } from "@/shared/lib/logger";
import { createSacTicket } from "../tickets/ticket-factory.server";

export async function pollReclameAquiCases(clientId: string): Promise<number> {
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("metadata")
    .eq("id", clientId)
    .single();

  const cnpj = (client?.metadata as { cnpj?: string } | null)?.cnpj;
  if (!cnpj) return 0;

  await logIntegration({
    client_id: clientId,
    provider: "reclame_aqui",
    operation: "poll_cases",
    status: "success",
    metadata: { cnpj, note: "MVP — ingestão manual ou parceria API" },
  });

  return 0;
}

export async function ingestReclameAquiCase(input: {
  clientId: string;
  externalId: string;
  cnpj: string;
  complaintText: string;
}): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("sac_reclame_aqui_cases")
    .select("ticket_id")
    .eq("external_id", input.externalId)
    .maybeSingle();

  if (existing?.ticket_id) return existing.ticket_id as string;

  const { ticketId } = await createSacTicket({
    clientId: input.clientId,
    channel: "site_form",
    category: "chargeback",
    priority: "critical",
    subject: `Reclame Aqui #${input.externalId}`,
    initialMessage: input.complaintText,
    metadata: { reclame_aqui_id: input.externalId },
  });

  let suggested = "";
  try {
    suggested = await callClaude(
      `Reclamação Reclame Aqui:\n${input.complaintText}`,
      "Sugira resposta profissional em português (máx 600 chars).",
    );
  } catch {
    suggested = "Prezado cliente, lamentamos o ocorrido e estamos analisando seu caso.";
  }

  await supabaseAdmin.from("sac_reclame_aqui_cases").insert({
    client_id: input.clientId,
    ticket_id: ticketId,
    external_id: input.externalId,
    cnpj: input.cnpj,
    complaint_text: input.complaintText,
    suggested_response: suggested,
    status: "open",
  });

  await supabaseAdmin.from("operation_alerts").insert({
    client_id: input.clientId,
    kind: "system",
    severity: "critical",
    title: `Nova reclamação Reclame Aqui`,
    message: `Caso #${input.externalId} requer resposta urgente.`,
    is_resolved: false,
  });

  return ticketId;
}

export async function runReclameAquiPoll(): Promise<{ polled: number }> {
  const { data: clients } = await supabaseAdmin.from("clients").select("id").eq("status", "active");
  let polled = 0;
  for (const client of clients ?? []) {
    polled += await pollReclameAquiCases(client.id);
  }
  return { polled };
}
