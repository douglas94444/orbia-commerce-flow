import { onDomainEvent } from "@/shared/lib/domain-events.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzeSacSentiment } from "./metrics/sentiment.server";
import { createSacTicket } from "./tickets/ticket-factory.server";
import type { Json } from "@/integrations/supabase/types";

onDomainEvent("sac.ticket.created", async (payload) => {
  const ticketId = String(payload.ticketId ?? "");
  if (!ticketId) return;
  await analyzeSacSentiment(ticketId).catch(() => undefined);
});

onDomainEvent("sac.ticket.escalated", async (payload) => {
  const ticketId = String(payload.ticketId ?? "");
  const clientId = String(payload.clientId ?? "");
  if (!ticketId || !clientId) return;

  await supabaseAdmin.from("sac_ticket_events").insert({
    ticket_id: ticketId,
    event_type: "escalated",
    new_value: String(payload.reason ?? "escalated"),
    metadata: payload as Json,
  });
});

onDomainEvent("order.delivery_problem", async (payload) => {
  const orderId = String(payload.orderId ?? "");
  const clientId = String(payload.clientId ?? "");
  if (!orderId || !clientId) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("customer_id, external_id")
    .eq("id", orderId)
    .single();

  await createSacTicket({
    clientId,
    channel: "whatsapp",
    category: "atraso",
    priority: "high",
    customerId: order?.customer_id ?? null,
    orderId,
    subject: `Problema de entrega — pedido ${order?.external_id ?? orderId.slice(0, 8)}`,
    initialMessage: "Problema de entrega detectado automaticamente.",
    metadata: { auto: true, source: "delivery_incident" },
  });
});

onDomainEvent("review.negative", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const orderId = String(payload.orderId ?? "");
  const customerId = payload.customerId ? String(payload.customerId) : null;
  if (!clientId) return;

  const { ticketId } = await createSacTicket({
    clientId,
    channel: "site_form",
    category: "produto_errado",
    priority: "high",
    customerId,
    orderId: orderId || null,
    subject: "Avaliação negativa pós-pedido",
    initialMessage: `Cliente deixou avaliação ${payload.rating ?? 1} estrela(s).`,
    metadata: { auto: true, review_id: payload.reviewId },
  });

  if (payload.reviewId) {
    await supabaseAdmin
      .from("cs_reviews")
      .update({ sac_ticket_id: ticketId })
      .eq("id", payload.reviewId);
  }
});
