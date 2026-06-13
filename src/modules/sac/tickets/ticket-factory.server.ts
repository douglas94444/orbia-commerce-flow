import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { computeSlaDueDates } from "../sla/sac-sla.server";

export type SacChannel =
  | "whatsapp"
  | "email"
  | "chat"
  | "instagram"
  | "mercado_livre"
  | "shopee"
  | "amazon"
  | "site_form";

export type SacPriority = "low" | "normal" | "high" | "urgent" | "critical";
export type SacCategory =
  | "rastreio"
  | "atraso"
  | "produto_errado"
  | "produto_danificado"
  | "devolucao"
  | "troca"
  | "cancelamento"
  | "duvida"
  | "elogio"
  | "fraude"
  | "chargeback";

function generateProtocol(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORB-${year}-${rand}`;
}

export interface CreateTicketInput {
  clientId: string;
  channel: SacChannel;
  category?: SacCategory;
  subcategory?: string;
  priority?: SacPriority;
  customerId?: string | null;
  orderId?: string | null;
  subject?: string;
  assignedTo?: string | null;
  sourceExternalId?: string;
  customerPhone?: string;
  customerEmail?: string;
  initialMessage?: string;
  metadata?: Record<string, unknown>;
  staffId?: string | null;
}

export async function createSacTicket(input: CreateTicketInput): Promise<{
  ticketId: string;
  protocol: string;
  conversationId: string;
}> {
  const protocol = generateProtocol();
  const sla = await computeSlaDueDates(input.clientId, input.channel, input.category ?? "duvida");

  const { data: ticket, error } = await supabaseAdmin
    .from("sac_tickets")
    .insert({
      protocol,
      client_id: input.clientId,
      customer_id: input.customerId ?? null,
      order_id: input.orderId ?? null,
      channel: input.channel,
      category: input.category ?? "duvida",
      subcategory: input.subcategory ?? null,
      priority: input.priority ?? "normal",
      status: "open",
      assigned_to: input.assignedTo ?? null,
      source_external_id: input.sourceExternalId ?? null,
      subject: input.subject ?? null,
      sla_response_due_at: sla.responseDueAt,
      sla_resolution_due_at: sla.resolutionDueAt,
      metadata: input.metadata ?? {},
    })
    .select("id, protocol")
    .single();

  if (error) throw new Error(error.message);

  const { data: conv, error: convErr } = await supabaseAdmin
    .from("sac_conversations")
    .insert({
      ticket_id: ticket.id,
      client_id: input.clientId,
      channel: input.channel,
      customer_phone: input.customerPhone ?? null,
      customer_email: input.customerEmail ?? null,
      unread_count: input.initialMessage ? 1 : 0,
    })
    .select("id")
    .single();

  if (convErr) throw new Error(convErr.message);

  await supabaseAdmin.from("sac_ticket_events").insert({
    ticket_id: ticket.id,
    staff_id: input.staffId ?? null,
    event_type: "created",
    new_value: "open",
    metadata: { channel: input.channel, category: input.category },
  });

  if (input.initialMessage) {
    await addSacMessage({
      conversationId: conv.id,
      ticketId: ticket.id,
      direction: "inbound",
      body: input.initialMessage,
      senderType: "customer",
    });
  }

  await emitDomainEvent("sac.ticket.created", {
    ticketId: ticket.id,
    clientId: input.clientId,
    protocol: ticket.protocol,
    channel: input.channel,
    priority: input.priority ?? "normal",
  });

  if (input.staffId) {
    await logAudit({
      user_id: input.staffId,
      client_id: input.clientId,
      action: "create",
      resource: "sac_ticket",
      resource_id: ticket.id,
    });
  }

  return { ticketId: ticket.id, protocol: ticket.protocol, conversationId: conv.id };
}

export async function addSacMessage(input: {
  conversationId: string;
  ticketId: string;
  direction: "inbound" | "outbound" | "system" | "bot";
  body: string;
  senderType: "customer" | "agent" | "bot" | "system";
  staffId?: string | null;
  attachments?: unknown[];
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("sac_messages")
    .insert({
      conversation_id: input.conversationId,
      ticket_id: input.ticketId,
      direction: input.direction,
      body: input.body,
      sender_type: input.senderType,
      staff_id: input.staffId ?? null,
      attachments: input.attachments ?? [],
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.direction === "inbound") {
    await supabaseAdmin.rpc("increment_sac_unread", { conv_id: input.conversationId }).catch(() => {
      supabaseAdmin
        .from("sac_conversations")
        .update({ unread_count: 1, updated_at: new Date().toISOString() })
        .eq("id", input.conversationId);
    });
  }

  await supabaseAdmin
    .from("sac_tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.ticketId);

  return data.id;
}

export async function sendProtocolConfirmation(
  clientId: string,
  channel: SacChannel,
  protocol: string,
  to: string,
): Promise<void> {
  const body = `Recebemos seu contato! Protocolo: ${protocol}. Nossa equipe responderá em breve.`;

  if (channel === "whatsapp") {
    const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
    const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");
    const creds = await getWhatsAppCredentials(clientId);
    if (creds?.provider === "meta") {
      await sendWhatsAppMessage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to,
        body,
        clientId,
      }).catch(() => undefined);
    }
  }
}
