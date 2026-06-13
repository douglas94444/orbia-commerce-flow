import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createSacTicket,
  addSacMessage,
  sendProtocolConfirmation,
} from "../tickets/ticket-factory.server";

const TRACKING_INTENTS = ["onde está", "onde esta", "rastreio", "rastrear", "tracking", "meu pedido"];
const NF_INTENTS = ["nota fiscal", "nf-e", "nfe", "nfse", "nfs-e", "segunda via"];
const RETURN_INTENTS = ["devolução", "devolucao", "troca", "trocar", "devolver"];
const HUMAN_INTENTS = ["atendente", "humano", "falar com", "falar_atendimento"];
const HOURS_INTENTS = ["horário", "horario", "funcionamento", "atendimento"];
const STOCK_INTENTS = ["estoque", "disponível", "disponivel", "tem em estoque"];

export interface ChatbotInput {
  clientId: string;
  customerId: string;
  channel: string;
  text: string;
  fromPhone?: string;
  fromEmail?: string;
  existingTicketId?: string;
  existingConversationId?: string;
}

export interface ChatbotResult {
  handled: boolean;
  handoff: boolean;
  reply?: string;
  ticketId?: string;
  protocol?: string;
  conversationId?: string;
}

function matchesIntent(text: string, intents: string[]): boolean {
  const lower = text.toLowerCase();
  return intents.some((i) => lower.includes(i));
}

async function getLastOrder(clientId: string, customerId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, status, tracking_code, external_id, created_at, value_cents")
    .eq("client_id", clientId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function getTrackingReply(orderId: string): Promise<string> {
  try {
    const { getOrderTrackingTimeline } = await import(
      "@/modules/logistics/shipping/tracking-timeline.server"
    );
    const { order, events } = await getOrderTrackingTimeline(orderId);
    if (!order) return "Seu pedido está sendo processado. Em breve teremos atualização de rastreio.";
    const last = events[events.length - 1];
    const tracking = order.tracking_code ? ` Código: ${order.tracking_code}` : "";
    if (!last) return `Pedido ${order.status}.${tracking}`;
    const label = (last as { label?: string; status?: string }).label
      ?? (last as { status?: string }).status
      ?? "em trânsito";
    const at = (last as { occurred_at?: string }).occurred_at ?? order.updated_at;
    return `Última atualização: ${label} em ${new Date(at).toLocaleDateString("pt-BR")}.${tracking}`;
  } catch {
    return "Consultamos seu pedido — em breve enviaremos a atualização de rastreio.";
  }
}

async function getNfReply(
  clientId: string,
  orderId: string,
  fromPhone?: string,
): Promise<string> {
  const { data: emissions } = await supabaseAdmin
    .from("nfe_emissions")
    .select("id, type, status, danfe_url, xml_storage_path, xml_url")
    .eq("client_id", clientId)
    .eq("order_id", orderId)
    .eq("status", "autorizada")
    .order("created_at", { ascending: false })
    .limit(2);

  const nfe = emissions?.find((e) => e.type === "NF-e" || e.type === "NFC-e");
  const nfse = emissions?.find((e) => e.type === "NFS-e");

  if (!nfe && !nfse) {
    return "Ainda não encontramos nota fiscal autorizada para este pedido. Nossa equipe verificará.";
  }

  const doc = nfe ?? nfse;
  const label = doc?.type === "NFS-e" ? "NFS-e" : doc?.type === "NFC-e" ? "NFC-e" : "NF-e";

  let downloadUrl = doc?.danfe_url as string | null;
  if (doc?.xml_storage_path) {
    const { createNfeXmlSignedUrl } = await import("@/modules/fiscal/nfe-storage.server");
    downloadUrl = (await createNfeXmlSignedUrl(doc.xml_storage_path as string)) ?? downloadUrl;
  } else if (doc?.xml_url) {
    downloadUrl = doc.xml_url as string;
  }

  if (fromPhone && downloadUrl) {
    const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
    const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");
    const creds = await getWhatsAppCredentials(clientId);
    if (creds?.provider === "meta") {
      await sendWhatsAppMessage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to: fromPhone,
        body: `Segunda via da sua ${label}. Link: ${downloadUrl}`,
        clientId,
        documentUrl: downloadUrl,
      }).catch(() => undefined);
    }
  }

  return `Sua ${label} foi localizada! ${downloadUrl ? "Enviamos o documento por WhatsApp." : "Nossa equipe enviará o PDF em instantes."}`;
}

async function ensureTicketContext(input: ChatbotInput): Promise<{
  ticketId: string;
  protocol: string;
  conversationId: string;
}> {
  if (input.existingTicketId && input.existingConversationId) {
    const { data: t } = await supabaseAdmin
      .from("sac_tickets")
      .select("protocol")
      .eq("id", input.existingTicketId)
      .single();
    return {
      ticketId: input.existingTicketId,
      protocol: t?.protocol ?? "",
      conversationId: input.existingConversationId,
    };
  }

  return createSacTicket({
    clientId: input.clientId,
    channel: input.channel as "whatsapp",
    category: "duvida",
    customerId: input.customerId,
    initialMessage: input.text,
    customerPhone: input.fromPhone,
    customerEmail: input.fromEmail,
  });
}

async function replyBot(
  ctx: { ticketId: string; conversationId: string },
  body: string,
  fromPhone?: string,
  clientId?: string,
): Promise<void> {
  await addSacMessage({
    conversationId: ctx.conversationId,
    ticketId: ctx.ticketId,
    direction: "outbound",
    body,
    senderType: "bot",
  });

  if (fromPhone && clientId) {
    const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
    const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");
    const creds = await getWhatsAppCredentials(clientId);
    if (creds?.provider === "meta") {
      await sendWhatsAppMessage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to: fromPhone,
        body,
        clientId,
      }).catch(() => undefined);
    }
  }
}

export async function processSacChatbot(input: ChatbotInput): Promise<ChatbotResult> {
  const text = input.text.trim();

  if (matchesIntent(text, HUMAN_INTENTS)) {
    const ctx = await ensureTicketContext(input);
    await supabaseAdmin.from("sac_bot_sessions").upsert(
      {
        conversation_id: ctx.conversationId,
        ticket_id: ctx.ticketId,
        handoff_requested: true,
        step: "handoff",
      },
      { onConflict: "conversation_id" },
    );
    await supabaseAdmin
      .from("sac_tickets")
      .update({ status: "open", priority: "normal" })
      .eq("id", ctx.ticketId);

    const reply = "Transferindo para um atendente humano. Horário comercial: seg–sex 9h–18h.";
    await replyBot(ctx, reply, input.fromPhone, input.clientId);
    return { handled: true, handoff: true, reply, ...ctx };
  }

  const order = await getLastOrder(input.clientId, input.customerId);

  if (matchesIntent(text, TRACKING_INTENTS) && order) {
    const ctx = await ensureTicketContext(input);
    const tracking = await getTrackingReply(order.id);
    const reply = `Pedido ${order.external_id ?? order.id.slice(0, 8)} — status: ${order.status}. ${tracking}`;
    await replyBot(ctx, reply, input.fromPhone, input.clientId);
    await supabaseAdmin
      .from("sac_tickets")
      .update({ status: "waiting_customer", order_id: order.id, category: "rastreio" })
      .eq("id", ctx.ticketId);
    return { handled: true, handoff: false, reply, ...ctx };
  }

  if (matchesIntent(text, NF_INTENTS) && order) {
    const ctx = await ensureTicketContext(input);
    const reply = await getNfReply(input.clientId, order.id, input.fromPhone);
    await replyBot(ctx, reply, input.fromPhone, input.clientId);
    return { handled: true, handoff: false, reply, ...ctx };
  }

  if (matchesIntent(text, RETURN_INTENTS)) {
    const ctx = await ensureTicketContext(input);
    const reply =
      "Para trocas e devoluções: você tem até 7 dias (CDC) para arrependimento. Acesse o link de devolução que enviaremos ou aguarde nosso atendente.";
    await replyBot(ctx, reply, input.fromPhone, input.clientId);
    await supabaseAdmin
      .from("sac_tickets")
      .update({ category: "devolucao" })
      .eq("id", ctx.ticketId);
    return { handled: true, handoff: false, reply, ...ctx };
  }

  if (matchesIntent(text, HOURS_INTENTS)) {
    const ctx = await ensureTicketContext(input);
    const reply = "Atendimento humano: seg–sex 9h–18h. Fora do horário, nosso assistente virtual responde 24h.";
    await replyBot(ctx, reply, input.fromPhone, input.clientId);
    return { handled: true, handoff: false, reply, ...ctx };
  }

  if (matchesIntent(text, STOCK_INTENTS)) {
    const ctx = await ensureTicketContext(input);
    const reply = "Para consultar disponibilidade, informe o SKU ou nome do produto. Nossa equipe confirmará o estoque em instantes.";
    await replyBot(ctx, reply, input.fromPhone, input.clientId);
    return { handled: true, handoff: false, reply, ...ctx };
  }

  const { data: kb } = await supabaseAdmin
    .from("sac_knowledge_articles")
    .select("title, slug, body")
    .eq("client_id", input.clientId)
    .eq("bot_enabled", true)
    .ilike("title", `%${text.slice(0, 20)}%`)
    .limit(1)
    .maybeSingle();

  if (kb) {
    const ctx = await ensureTicketContext(input);
    const reply = `${kb.title}: ${kb.body.slice(0, 300)}... Mais em /help/${kb.slug}`;
    await replyBot(ctx, reply, input.fromPhone, input.clientId);
    return { handled: true, handoff: false, reply, ...ctx };
  }

  return { handled: false, handoff: false };
}

export async function isOutsideBusinessHours(): Promise<boolean> {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 0 || day === 6) return true;
  return hour < 9 || hour >= 18;
}
