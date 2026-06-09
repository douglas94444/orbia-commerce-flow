import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/integrations/resend";
import { getServerConfig } from "@/lib/config.server";

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
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
  if (!email) return;

  const { data: flows } = await supabaseAdmin
    .from("automation_flows")
    .select("id, name, sent_30d")
    .eq("client_id", order.client_id)
    .eq("trigger", "pedido_entregue")
    .eq("channel", "email")
    .eq("is_active", true);

  if (!flows?.length) return;

  const emailHash = hashEmail(email);

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .upsert(
      {
        client_id: order.client_id,
        email_hash: emailHash,
        order_count: 1,
        last_order_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,email_hash" },
    )
    .select("id")
    .single();

  const { appUrl } = getServerConfig();
  const storeLink = appUrl;

  for (const flow of flows) {
    let executionStatus: "sent" | "failed" = "sent";

    try {
      await sendEmail({
        to: email,
        subject: "Obrigado pela compra!",
        html: `<p>Obrigado pela sua compra na nossa loja.</p><p>Esperamos vê-lo novamente em <a href="${storeLink}">${storeLink}</a>.</p>`,
        clientId: order.client_id,
      });
    } catch {
      executionStatus = "failed";
    }

    await supabaseAdmin.from("automation_executions").insert({
      flow_id: flow.id,
      customer_id: customer?.id ?? null,
      status: executionStatus,
      metadata: { order_id: orderId, channel: order.channel },
    });

    if (executionStatus === "sent") {
      await supabaseAdmin
        .from("automation_flows")
        .update({ sent_30d: (flow.sent_30d ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", flow.id);
    }
  }
}
