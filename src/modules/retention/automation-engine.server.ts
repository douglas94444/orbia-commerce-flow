import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { sendEmail } from "@/integrations/resend";
import { sendTemplateMessage } from "@/integrations/whatsapp";
import { getServerConfig } from "@/lib/config.server";

function hashValue(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

interface AutomationFlowRow {
  id: string;
  name: string;
  channel: string;
  sent_30d: number | null;
  metadata: Record<string, unknown> | null;
}

async function getWhatsAppConnection(clientId: string) {
  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("client_id", clientId)
    .eq("provider", "whatsapp")
    .eq("is_active", true)
    .maybeSingle();

  if (!data?.access_token) return null;
  const meta = (data.metadata ?? {}) as Record<string, unknown>;
  const phoneNumberId = String(meta.phone_number_id ?? "");
  if (!phoneNumberId) return null;
  return { accessToken: decryptToken(data.access_token), phoneNumberId };
}

async function executeFlow(
  flow: AutomationFlowRow,
  input: {
    orderId: string;
    clientId: string;
    channel: string;
    email: string | null;
    phone: string | null;
    customerId: string | null;
    storeName: string;
  },
): Promise<"sent" | "failed"> {
  const { appUrl } = getServerConfig();

  try {
    if (flow.channel === "email") {
      if (!input.email) return "failed";
      await sendEmail({
        to: input.email,
        subject: "Obrigado pela compra!",
        html: `<p>Obrigado pela sua compra na ${input.storeName}.</p><p>Esperamos vê-lo novamente em <a href="${appUrl}">${appUrl}</a>.</p>`,
        clientId: input.clientId,
      });
      return "sent";
    }

    if (flow.channel === "whatsapp") {
      if (!input.phone) return "failed";
      const wa = await getWhatsAppConnection(input.clientId);
      if (!wa) return "failed";

      const meta = flow.metadata ?? {};
      const templateName = String(meta.template_name ?? "pedido_entregue_obrigado");
      const language = String(meta.language ?? "pt_BR");

      await sendTemplateMessage({
        phoneNumberId: wa.phoneNumberId,
        accessToken: wa.accessToken,
        to: normalizePhone(input.phone),
        templateName,
        language,
        bodyParams: [input.storeName],
        clientId: input.clientId,
      });
      return "sent";
    }

    return "failed";
  } catch {
    return "failed";
  }
}

export async function onOrderDelivered(orderId: string): Promise<void> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, metadata, channel")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(`Order ${orderId} not found`);

  const metadata = order.metadata as Record<string, unknown>;
  const email = metadata.customer_email ? String(metadata.customer_email) : null;
  const phone = metadata.customer_phone ? String(metadata.customer_phone) : null;

  if (!email && !phone) return;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name")
    .eq("id", order.client_id)
    .single();

  const { data: flows } = await supabaseAdmin
    .from("automation_flows")
    .select("id, name, channel, sent_30d, metadata")
    .eq("client_id", order.client_id)
    .eq("trigger", "pedido_entregue")
    .eq("is_active", true);

  if (!flows?.length) return;

  let customerId: string | null = null;

  if (email || phone) {
    const emailHash = email ? hashValue(email) : hashValue(`phone:${phone}`);
    const upsert: Record<string, unknown> = {
      client_id: order.client_id,
      email_hash: emailHash,
      order_count: 1,
      last_order_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (phone) upsert.phone_hash = hashValue(phone);

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .upsert(upsert, { onConflict: "client_id,email_hash" })
      .select("id")
      .single();
    customerId = customer?.id ?? null;
  }

  for (const flow of flows) {
    const executionStatus = await executeFlow(flow, {
      orderId,
      clientId: order.client_id,
      channel: order.channel,
      email,
      phone,
      customerId,
      storeName: client?.name ?? "nossa loja",
    });

    await supabaseAdmin.from("automation_executions").insert({
      flow_id: flow.id,
      customer_id: customerId,
      status: executionStatus,
      metadata: { order_id: orderId, channel: flow.channel, wa_message_id: null },
    });

    if (executionStatus === "sent") {
      await supabaseAdmin
        .from("automation_flows")
        .update({ sent_30d: (flow.sent_30d ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", flow.id);
    }
  }
}

export async function updateWhatsAppExecutionStatus(
  messageId: string,
  status: "delivered" | "read" | "failed",
): Promise<void> {
  const mapped = status === "read" ? "delivered" : status;
  const { data: rows } = await supabaseAdmin
    .from("automation_executions")
    .select("id, metadata")
    .contains("metadata", { wa_message_id: messageId })
    .limit(1);

  if (!rows?.length) {
    const { data: recent } = await supabaseAdmin
      .from("automation_executions")
      .select("id")
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(20);

    if (recent?.[0]) {
      await supabaseAdmin
        .from("automation_executions")
        .update({ status: mapped })
        .eq("id", recent[0].id);
    }
    return;
  }

  await supabaseAdmin
    .from("automation_executions")
    .update({ status: mapped })
    .eq("id", rows[0].id);
}
