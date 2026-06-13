import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { createReturnRequest } from "@/modules/logistics/returns/returns.server";
import { addSacMessage } from "../tickets/ticket-factory.server";

export async function createReturnFromSacTicket(input: {
  clientId: string;
  ticketId: string;
  orderId: string;
  reason: string;
  items: Array<{ sku: string; qty: number }>;
  staffId: string;
}): Promise<string> {
  const { data: ticket } = await supabaseAdmin
    .from("sac_tickets")
    .select("customer_id")
    .eq("id", input.ticketId)
    .eq("client_id", input.clientId)
    .single();

  const returnId = await createReturnRequest({
    clientId: input.clientId,
    orderId: input.orderId,
    customerId: ticket?.customer_id ?? undefined,
    reason: input.reason,
    items: input.items,
  });

  await supabaseAdmin
    .from("return_requests")
    .update({ sac_ticket_id: input.ticketId })
    .eq("id", returnId);

  const { data: conv } = await supabaseAdmin
    .from("sac_conversations")
    .select("id")
    .eq("ticket_id", input.ticketId)
    .limit(1)
    .maybeSingle();

  if (conv) {
    await addSacMessage({
      conversationId: conv.id,
      ticketId: input.ticketId,
      direction: "system",
      body: `Devolução aberta (#${returnId.slice(0, 8)}). Aguardando aprovação.`,
      senderType: "system",
      staffId: input.staffId,
    });
  }

  await supabaseAdmin
    .from("sac_tickets")
    .update({ category: "devolucao", order_id: input.orderId })
    .eq("id", input.ticketId);

  await logAudit({
    user_id: input.staffId,
    client_id: input.clientId,
    action: "create",
    resource: "return_request",
    resource_id: returnId,
  });

  return returnId;
}
