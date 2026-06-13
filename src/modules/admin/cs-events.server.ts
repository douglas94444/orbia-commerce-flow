import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { refreshClientLastContact } from "./admin.server";
import { createSacTicket } from "@/modules/sac/tickets/ticket-factory.server";

/** Abre atividade CS quando há problema de entrega. */
export async function notifyCsOnDeliveryProblem(
  orderId: string,
  clientId: string,
): Promise<void> {
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
    subject: `Problema de entrega — ${order?.external_id ?? orderId.slice(0, 8)}`,
    initialMessage: "Problema de entrega detectado — ticket SAC proativo.",
    metadata: { auto: true, source: "delivery_problem" },
  });

  const { data: staff } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["orbia_admin", "orbia_staff"])
    .limit(1)
    .maybeSingle();

  if (staff?.id) {
    await supabaseAdmin.from("cs_activities").insert({
      client_id: clientId,
      staff_id: staff.id,
      kind: "support_ticket",
      notes: `Problema de entrega no pedido ${orderId.slice(0, 8)} — verificar com transportadora.`,
      metadata: { order_id: orderId, auto: true },
    });
    await refreshClientLastContact(clientId);
  }
}

/** Abre ticket CS quando SLA de despacho estoura. */
export async function notifyCsOnSlaBreach(
  orderId: string,
  clientId: string,
  externalId: string,
): Promise<void> {
  const { data: staff } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["orbia_admin", "orbia_staff"])
    .limit(1)
    .maybeSingle();

  if (staff?.id) {
    await supabaseAdmin.from("cs_activities").insert({
      client_id: clientId,
      staff_id: staff.id,
      kind: "support_ticket",
      notes: `SLA de despacho estourado — pedido ${externalId}. Priorizar expedição.`,
      metadata: { order_id: orderId, auto: true, type: "sla_breach" },
    });
    await refreshClientLastContact(clientId);
  }
}

/** Notifica CS quando pedido é entregue — cria nota de onboarding e alerta se SLA longo. */
export async function notifyCsOnOrderDelivered(
  orderId: string,
  clientId: string,
): Promise<void> {
  const { data: staff } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["orbia_admin", "orbia_staff"])
    .limit(1)
    .maybeSingle();

  if (staff?.id) {
    await supabaseAdmin.from("cs_activities").insert({
      client_id: clientId,
      staff_id: staff.id,
      kind: "onboarding_note",
      notes: `Pedido ${orderId.slice(0, 8)} entregue — acompanhar satisfação pós-entrega.`,
      metadata: { order_id: orderId, auto: true },
    });
    await refreshClientLastContact(clientId);
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name, last_contact_days")
    .eq("id", clientId)
    .single();

  if ((client?.last_contact_days ?? 0) > 14) {
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "health",
      severity: "warning",
      title: "Cliente sem contato após entrega",
      message: `${client?.name ?? "Cliente"} entregou pedido mas está há ${client?.last_contact_days}d sem contato CS.`,
      is_resolved: false,
    });
  }
}
