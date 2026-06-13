import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/integrations/claude/client.server";

export async function suggestSacReply(ticketId: string): Promise<string> {
  const { data: ticket } = await supabaseAdmin
    .from("sac_tickets")
    .select("category, channel, subject")
    .eq("id", ticketId)
    .single();

  const { data: messages } = await supabaseAdmin
    .from("sac_messages")
    .select("direction, body, sender_type")
    .eq("ticket_id", ticketId)
    .order("created_at")
    .limit(10);

  const thread = (messages ?? [])
    .map((m) => `${m.sender_type}: ${m.body}`)
    .join("\n");

  const prompt = [
    "Você é um atendente de SAC de e-commerce brasileiro.",
    `Categoria: ${ticket?.category ?? "duvida"}`,
    `Canal: ${ticket?.channel ?? "whatsapp"}`,
    ticket?.subject ? `Assunto: ${ticket.subject}` : "",
    "Histórico recente:",
    thread || "(sem mensagens)",
    "Sugira uma resposta cordial, objetiva e em português brasileiro (máx. 400 caracteres).",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    return await callClaude(prompt, "Responda apenas com o texto da sugestão, sem prefixos.");
  } catch {
    return "Olá! Obrigado pelo contato. Estamos verificando sua solicitação e retornaremos em breve.";
  }
}
