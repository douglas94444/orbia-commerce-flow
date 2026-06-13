import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration } from "@/shared/lib/logger";
import { createSacTicket } from "../tickets/ticket-factory.server";

export async function pollInstagramDm(clientId: string): Promise<number> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("client_id", clientId)
    .eq("provider", "meta")
    .eq("status", "active")
    .maybeSingle();

  if (!conn?.access_token) return 0;

  await logIntegration({
    client_id: clientId,
    provider: "meta",
    operation: "poll_instagram_dm",
    status: "success",
    metadata: { note: "poll stub — Graph API Instagram messaging" },
  });

  return 0;
}

export async function ingestInstagramDm(
  clientId: string,
  threadId: string,
  fromUserId: string,
  text: string,
): Promise<string> {
  const { ticketId, conversationId } = await createSacTicket({
    clientId,
    channel: "instagram",
    category: "duvida",
    priority: "normal",
    sourceExternalId: threadId,
    initialMessage: text,
    metadata: { instagram_user_id: fromUserId },
  });

  await supabaseAdmin
    .from("sac_conversations")
    .update({ external_thread_id: threadId })
    .eq("id", conversationId);

  return ticketId;
}
