import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOrderContact, syncCustomerFromOrder } from "./customer-sync.server";
import { enrollInSequence, ensureDefaultSequences } from "./enrollment.server";
import { earnPointsFromOrder } from "./loyalty.server";

async function buildEnrollmentContext(orderId: string) {
  const contact = await getOrderContact(orderId);
  const items = (contact.metadata.items ?? contact.metadata.products ?? []) as Array<Record<string, unknown>>;
  const firstItem = items[0];

  return {
    order_id: orderId,
    email: contact.email,
    phone: contact.phone,
    customer_name: contact.customerName,
    value_cents: contact.valueCents,
    tracking_code: contact.trackingCode,
    product_name: firstItem?.name ? String(firstItem.name) : firstItem?.title ? String(firstItem.title) : undefined,
    product_image: firstItem?.image ? String(firstItem.image) : undefined,
    acquisition_channel: contact.channel,
  };
}

async function enrollForOrder(
  orderId: string,
  trigger: string,
  delayMinutes?: number,
): Promise<void> {
  const contact = await getOrderContact(orderId);
  await ensureDefaultSequences(contact.clientId);

  const customerId = await syncCustomerFromOrder({
    orderId,
    clientId: contact.clientId,
    valueCents: contact.valueCents,
    email: contact.email,
    phone: contact.phone,
    acquisitionChannel: contact.channel,
    customerName: contact.customerName,
  });

  const context = await buildEnrollmentContext(orderId);
  await enrollInSequence({
    clientId: contact.clientId,
    trigger,
    customerId,
    context,
    delayMinutes,
  });
}

export async function onOrderPaid(orderId: string): Promise<void> {
  const contact = await getOrderContact(orderId);
  const customerId = await syncCustomerFromOrder({
    orderId,
    clientId: contact.clientId,
    valueCents: contact.valueCents,
    email: contact.email,
    phone: contact.phone,
    acquisitionChannel: contact.channel,
    customerName: contact.customerName,
  });

  if (customerId) {
    await earnPointsFromOrder(customerId, contact.clientId, orderId, contact.valueCents);
  }
}

export async function onOrderDispatched(orderId: string): Promise<void> {
  await enrollForOrder(orderId, "pedido_despachado");
}

export async function onOrderDelivered(orderId: string): Promise<void> {
  await enrollForOrder(orderId, "pedido_entregue");
  await enrollForOrder(orderId, "pos_entrega_7d", 7 * 24 * 60);
}

export async function onNfeAuthorized(
  orderId: string,
  danfeUrl: string | null,
): Promise<void> {
  const contact = await getOrderContact(orderId);
  await ensureDefaultSequences(contact.clientId);

  const customerId = await syncCustomerFromOrder({
    orderId,
    clientId: contact.clientId,
    valueCents: contact.valueCents,
    email: contact.email,
    phone: contact.phone,
    acquisitionChannel: contact.channel,
  });

  const context = await buildEnrollmentContext(orderId);

  await enrollInSequence({
    clientId: contact.clientId,
    trigger: "nfe_autorizada",
    customerId,
    context: { ...context, danfe_url: danfeUrl },
  });
}

export async function updateWhatsAppExecutionStatus(
  messageId: string,
  status: "delivered" | "read" | "failed",
): Promise<void> {
  const mapped = status === "read" ? "opened" : status;

  const { data: log } = await supabaseAdmin
    .from("message_delivery_log")
    .select("id, execution_id")
    .eq("provider_message_id", messageId)
    .maybeSingle();

  if (log) {
    await supabaseAdmin
      .from("message_delivery_log")
      .update({
        status: mapped,
        opened_at: status === "read" ? new Date().toISOString() : undefined,
      })
      .eq("id", log.id);

    if (log.execution_id) {
      await supabaseAdmin
        .from("automation_executions")
        .update({ status: mapped === "opened" ? "delivered" : mapped })
        .eq("id", log.execution_id);
    }
    return;
  }

  const { data: rows } = await supabaseAdmin
    .from("automation_executions")
    .select("id, metadata")
    .contains("metadata", { provider_message_id: messageId })
    .limit(1);

  if (rows?.[0]) {
    await supabaseAdmin
      .from("automation_executions")
      .update({ status: mapped === "opened" ? "delivered" : mapped })
      .eq("id", rows[0].id);
  }
}
