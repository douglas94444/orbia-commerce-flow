import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { findCustomerByIdentity, hashContact } from "@/modules/retention/customer-identity.server";
import {
  createSacTicket,
  sendProtocolConfirmation,
  addSacMessage,
  type SacCategory,
  type SacPriority,
} from "../tickets/ticket-factory.server";
import { processSacChatbot } from "../chatbot/sac-chatbot.server";

const PRIORITY_SCORE: Record<SacPriority, number> = {
  critical: 100,
  urgent: 80,
  high: 60,
  normal: 40,
  low: 20,
};

const TRACKING_KEYWORDS = ["rastreio", "rastrear", "onde está", "onde esta", "pedido", "entrega", "tracking"];
const RETURN_KEYWORDS = ["devolução", "devolucao", "troca", "trocar", "devolver"];
const CHARGEBACK_KEYWORDS = ["chargeback", "estorno", "fraude", "contestação", "contestacao"];

export interface RouteInboundInput {
  clientId: string;
  channel: "whatsapp" | "email" | "site_form" | "mercado_livre" | "shopee" | "amazon" | "instagram" | "chat";
  text: string;
  fromPhone?: string;
  fromEmail?: string;
  customerId?: string | null;
  replyId?: string;
  forceHuman?: boolean;
}

export interface RouteInboundResult {
  ticketId: string;
  protocol: string;
  handledByBot: boolean;
  botReply?: string;
}

function detectCategory(text: string): SacCategory {
  const lower = text.toLowerCase();
  if (CHARGEBACK_KEYWORDS.some((k) => lower.includes(k))) return "chargeback";
  if (RETURN_KEYWORDS.some((k) => lower.includes(k))) return "devolucao";
  if (TRACKING_KEYWORDS.some((k) => lower.includes(k))) return "rastreio";
  if (lower.includes("atraso") || lower.includes("atrasado")) return "atraso";
  return "duvida";
}

function detectPriority(category: SacCategory, text: string): SacPriority {
  if (category === "chargeback" || category === "fraude") return "critical";
  const lower = text.toLowerCase();
  if (lower.includes("urgente") || category === "atraso") return "urgent";
  if (category === "produto_danificado" || category === "produto_errado") return "high";
  return "normal";
}

async function resolveCustomerId(input: RouteInboundInput): Promise<string | null> {
  if (input.customerId) return input.customerId;

  const cpfMatch = input.text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  const orderMatch = input.text.match(/(?:pedido|order|#)\s*([a-f0-9-]{8,36})/i);

  if (cpfMatch) {
    const id = await findCustomerByIdentity({
      clientId: input.clientId,
      document: cpfMatch[0],
    });
    if (id) return id;
  }

  if (orderMatch) {
    const orderRef = orderMatch[1];
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("customer_id")
      .eq("client_id", input.clientId)
      .or(`id.eq.${orderRef},external_id.eq.${orderRef}`)
      .maybeSingle();
    if (order?.customer_id) return order.customer_id as string;
  }

  if (input.fromPhone) {
    return findCustomerByIdentity({
      clientId: input.clientId,
      phone: input.fromPhone,
    });
  }

  if (input.fromEmail) {
    return findCustomerByIdentity({
      clientId: input.clientId,
      email: input.fromEmail,
    });
  }

  return null;
}

async function checkDeliveryIncidentBoost(
  clientId: string,
  customerId: string | null,
  orderId?: string | null,
): Promise<SacPriority | null> {
  if (!orderId) return null;

  const { data } = await supabaseAdmin
    .from("delivery_incidents")
    .select("id")
    .eq("order_id", orderId)
    .eq("resolved", false)
    .limit(1)
    .maybeSingle();

  return data ? "high" : null;
}

import { reopenOnCustomerReply } from "../automations/sac-automations.server";

export async function routeInboundMessage(input: RouteInboundInput): Promise<RouteInboundResult> {
  const customerId = await resolveCustomerId(input);

  if (customerId) {
    const { data: openTicket } = await supabaseAdmin
      .from("sac_tickets")
      .select("id, protocol, sac_conversations(id)")
      .eq("client_id", input.clientId)
      .eq("customer_id", customerId)
      .in("status", ["closed", "resolved"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openTicket) {
      await reopenOnCustomerReply(openTicket.id);
      const conv = Array.isArray(openTicket.sac_conversations)
        ? openTicket.sac_conversations[0]
        : openTicket.sac_conversations;
      if (conv) {
        await addSacMessage({
          conversationId: conv.id,
          ticketId: openTicket.id,
          direction: "inbound",
          body: input.text,
          senderType: "customer",
        });
        return { ticketId: openTicket.id, protocol: openTicket.protocol, handledByBot: false };
      }
    }
  }

  const category = detectCategory(input.text);
  let priority = detectPriority(category, input.text);

  const incidentBoost = await checkDeliveryIncidentBoost(input.clientId, customerId);
  if (incidentBoost) priority = incidentBoost;

  const forceHuman =
    input.forceHuman ||
    input.replyId === "falar_atendimento" ||
    category === "chargeback";

  if (!forceHuman && category === "rastreio" && customerId) {
    const botResult = await processSacChatbot({
      clientId: input.clientId,
      customerId,
      channel: input.channel,
      text: input.text,
      fromPhone: input.fromPhone,
      fromEmail: input.fromEmail,
    });
    if (botResult.handled && !botResult.handoff) {
      return {
        ticketId: botResult.ticketId ?? "",
        protocol: botResult.protocol ?? "",
        handledByBot: true,
        botReply: botResult.reply,
      };
    }
  }

  if (!forceHuman && customerId) {
    const botResult = await processSacChatbot({
      clientId: input.clientId,
      customerId,
      channel: input.channel,
      text: input.text,
      fromPhone: input.fromPhone,
      fromEmail: input.fromEmail,
    });
    if (botResult.handled && !botResult.handoff) {
      return {
        ticketId: botResult.ticketId!,
        protocol: botResult.protocol!,
        handledByBot: true,
        botReply: botResult.reply,
      };
    }
  }

  const { ticketId, protocol, conversationId } = await createSacTicket({
    clientId: input.clientId,
    channel: input.channel,
    category,
    priority,
    customerId,
    initialMessage: input.text,
    customerPhone: input.fromPhone,
    customerEmail: input.fromEmail,
    metadata: { reply_id: input.replyId },
  });

  if (input.fromPhone && input.channel === "whatsapp") {
    await sendProtocolConfirmation(input.clientId, "whatsapp", protocol, input.fromPhone);
  }

  return { ticketId, protocol, handledByBot: false };
}

export function inboxPriorityScore(priority: SacPriority, slaDueAt: string | null): number {
  let score = PRIORITY_SCORE[priority] ?? 40;
  if (slaDueAt) {
    const minsLeft = (new Date(slaDueAt).getTime() - Date.now()) / 60_000;
    if (minsLeft < 30) score += 50;
    else if (minsLeft < 60) score += 25;
  }
  return score;
}

export { hashContact };
