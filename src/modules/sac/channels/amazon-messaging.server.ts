import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration } from "@/shared/lib/logger";
import { createSacTicket } from "../tickets/ticket-factory.server";

export async function pollAmazonMessages(clientId: string): Promise<number> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token")
    .eq("client_id", clientId)
    .eq("provider", "amazon")
    .eq("status", "active")
    .maybeSingle();

  if (!conn?.access_token) return 0;

  await logIntegration({
    client_id: clientId,
    provider: "amazon",
    operation: "poll_buyer_messages",
    status: "success",
    metadata: { note: "poll stub — SP-API messaging" },
  });

  return 0;
}

export async function ingestAmazonClaim(
  clientId: string,
  externalId: string,
  text: string,
): Promise<string> {
  const { ticketId } = await createSacTicket({
    clientId,
    channel: "amazon",
    category: "chargeback",
    priority: "urgent",
    sourceExternalId: externalId,
    initialMessage: text,
    subject: `A-to-Z Amazon #${externalId}`,
  });

  await supabaseAdmin.from("sac_marketplace_claims").insert({
    client_id: clientId,
    ticket_id: ticketId,
    platform: "amazon",
    external_claim_id: externalId,
    status: "open",
  });

  return ticketId;
}
