import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { checkSacSlaBreaches } from "../sla/sac-sla.server";
import { addSacMessage } from "../tickets/ticket-factory.server";

const REMINDER_HOURS = 48;
const AUTO_CLOSE_DAYS = 7;

export async function scheduleSacCsat(ticketId: string, clientId: string): Promise<void> {
  const { data: ticket } = await supabaseAdmin
    .from("sac_tickets")
    .select("channel")
    .eq("id", ticketId)
    .single();

  await supabaseAdmin.from("sac_csat_surveys").insert({
    ticket_id: ticketId,
    client_id: clientId,
    channel: ticket?.channel ?? "whatsapp",
  });
}

export async function sendPendingCsatSurveys(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const { data: pending } = await supabaseAdmin
    .from("sac_csat_surveys")
    .select("id, ticket_id, client_id, channel")
    .is("score", null)
    .lte("sent_at", cutoff)
    .limit(50);

  let sent = 0;
  for (const survey of pending ?? []) {
    const { data: conv } = await supabaseAdmin
      .from("sac_conversations")
      .select("customer_phone")
      .eq("ticket_id", survey.ticket_id)
      .limit(1)
      .maybeSingle();

    if (survey.channel === "whatsapp" && conv?.customer_phone) {
      const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
      const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");
      const creds = await getWhatsAppCredentials(survey.client_id);
      if (creds?.provider === "meta") {
        await sendWhatsAppMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: conv.customer_phone,
          body: "Como foi seu atendimento? Responda de 1 a 5 (1=péssimo, 5=excelente).",
          clientId: survey.client_id,
        }).catch(() => undefined);
        sent++;
      }
    }
  }
  return sent;
}

export async function sendWaitingCustomerReminders(): Promise<number> {
  const cutoff = new Date(Date.now() - REMINDER_HOURS * 60 * 60_000).toISOString();

  const { data: tickets } = await supabaseAdmin
    .from("sac_tickets")
    .select("id, client_id, protocol")
    .eq("status", "waiting_customer")
    .lte("updated_at", cutoff)
    .limit(30);

  let reminded = 0;
  for (const t of tickets ?? []) {
    const { data: conv } = await supabaseAdmin
      .from("sac_conversations")
      .select("id, customer_phone, channel")
      .eq("ticket_id", t.id)
      .limit(1)
      .maybeSingle();

    if (!conv) continue;

    const body = `Olá! Ainda aguardamos sua resposta sobre o protocolo ${t.protocol}. Pode nos retornar quando possível?`;
    await addSacMessage({
      conversationId: conv.id,
      ticketId: t.id,
      direction: "outbound",
      body,
      senderType: "system",
    });

    if (conv.channel === "whatsapp" && conv.customer_phone) {
      const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
      const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");
      const creds = await getWhatsAppCredentials(t.client_id);
      if (creds?.provider === "meta") {
        await sendWhatsAppMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: conv.customer_phone,
          body,
          clientId: t.client_id,
        }).catch(() => undefined);
      }
    }
    reminded++;
  }
  return reminded;
}

export async function autoCloseStaleTickets(): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_DAYS * 24 * 60 * 60_000).toISOString();

  const { data: tickets } = await supabaseAdmin
    .from("sac_tickets")
    .select("id, client_id")
    .eq("status", "waiting_customer")
    .lte("updated_at", cutoff)
    .limit(50);

  let closed = 0;
  for (const t of tickets ?? []) {
    await supabaseAdmin
      .from("sac_tickets")
      .update({ status: "closed", resolved_at: new Date().toISOString() })
      .eq("id", t.id);

    await supabaseAdmin.from("sac_ticket_events").insert({
      ticket_id: t.id,
      event_type: "status_change",
      old_value: "waiting_customer",
      new_value: "closed",
      metadata: { auto: true, reason: "no_customer_response" },
    });

    await scheduleSacCsat(t.id, t.client_id);
    closed++;
  }
  return closed;
}

export async function reopenOnCustomerReply(ticketId: string): Promise<void> {
  const { data: ticket } = await supabaseAdmin
    .from("sac_tickets")
    .select("status, client_id")
    .eq("id", ticketId)
    .single();

  if (!ticket || !["closed", "resolved"].includes(ticket.status)) return;

  await supabaseAdmin
    .from("sac_tickets")
    .update({ status: "open", resolved_at: null })
    .eq("id", ticketId);

  await supabaseAdmin.from("sac_ticket_events").insert({
    ticket_id: ticketId,
    event_type: "status_change",
    old_value: ticket.status,
    new_value: "open",
    metadata: { auto: true, reason: "customer_replied" },
  });
}

export async function escalateCriticalTickets(): Promise<number> {
  const { data: critical } = await supabaseAdmin
    .from("sac_tickets")
    .select("id, client_id, protocol")
    .eq("priority", "critical")
    .in("status", ["open", "in_progress"])
    .is("assigned_to", null)
    .limit(20);

  let escalated = 0;
  for (const t of critical ?? []) {
    await emitDomainEvent("sac.ticket.escalated", {
      ticketId: t.id,
      clientId: t.client_id,
      reason: "critical_unassigned",
    });

    await supabaseAdmin.from("operation_alerts").insert({
      client_id: t.client_id,
      kind: "system",
      severity: "critical",
      title: `Ticket crítico sem atendente — ${t.protocol}`,
      message: `Protocolo ${t.protocol} requer atenção imediata.`,
      is_resolved: false,
    });
    escalated++;
  }
  return escalated;
}

export async function sendDailySacSummary(): Promise<number> {
  const { data: clients } = await supabaseAdmin.from("clients").select("id").eq("status", "active");
  let sent = 0;

  for (const client of clients ?? []) {
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { count: open } = await supabaseAdmin
      .from("sac_tickets")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .in("status", ["open", "in_progress"]);

    const { count: newToday } = await supabaseAdmin
      .from("sac_tickets")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("created_at", since);

    if ((newToday ?? 0) === 0 && (open ?? 0) === 0) continue;

    await supabaseAdmin.from("operation_alerts").insert({
      client_id: client.id,
      kind: "system",
      severity: "info",
      title: "Resumo diário SAC",
      message: `${newToday ?? 0} novos tickets hoje. ${open ?? 0} em aberto.`,
      is_resolved: false,
    });
    sent++;
  }
  return sent;
}

export async function runSacAutomations(): Promise<Record<string, number>> {
  const [slaAlerts, csat, reminders, closed, escalated, summary] = await Promise.all([
    checkSacSlaBreaches(),
    sendPendingCsatSurveys(),
    sendWaitingCustomerReminders(),
    autoCloseStaleTickets(),
    escalateCriticalTickets(),
    sendDailySacSummary(),
  ]);

  return { slaAlerts, csat, reminders, closed, escalated, summary };
}
