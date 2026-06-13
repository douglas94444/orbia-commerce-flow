import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration } from "@/shared/lib/logger";
import { createSacTicket } from "../tickets/ticket-factory.server";

export async function pollShopeeMessages(clientId: string): Promise<number> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token")
    .eq("client_id", clientId)
    .eq("provider", "shopee")
    .eq("status", "active")
    .maybeSingle();

  if (!conn?.access_token) return 0;

  await logIntegration({
    client_id: clientId,
    provider: "shopee",
    operation: "poll_messages",
    status: "success",
    metadata: { note: "poll stub — aguardando credenciais messaging" },
  });

  return 0;
}

export async function ingestShopeeDispute(
  clientId: string,
  externalId: string,
  text: string,
): Promise<string> {
  const { ticketId } = await createSacTicket({
    clientId,
    channel: "shopee",
    category: "chargeback",
    priority: "urgent",
    sourceExternalId: externalId,
    initialMessage: text,
    subject: `Disputa Shopee #${externalId}`,
  });

  await supabaseAdmin.from("sac_marketplace_claims").insert({
    client_id: clientId,
    ticket_id: ticketId,
    platform: "shopee",
    external_claim_id: externalId,
    status: "open",
  });

  return ticketId;
}
