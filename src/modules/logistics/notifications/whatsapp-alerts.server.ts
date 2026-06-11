import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration } from "@/shared/lib/logger";

export async function sendWhatsAppToClient(
  clientId: string,
  message: string,
): Promise<void> {
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("metadata")
    .eq("id", clientId)
    .maybeSingle();

  const phone = (client?.metadata as Record<string, unknown> | null)?.whatsapp_phone as
    | string
    | undefined;

  if (!phone) {
    await logIntegration({
      client_id: clientId,
      provider: "whatsapp",
      operation: "sla_alert_skipped",
      status: "success",
      metadata: { reason: "no_phone_configured" },
    });
    return;
  }

  try {
    const { sendWhatsAppMessageSimple } = await import("@/integrations/whatsapp/client");
    await sendWhatsAppMessageSimple({ to: phone, body: message, clientId });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: "whatsapp",
      operation: "sla_alert",
      status: "error",
      error_message: (err as Error).message,
    });
  }
}

export async function sendTrackingWhatsApp(
  clientId: string,
  customerPhone: string,
  event: "dispatched" | "out_for_delivery" | "delivered",
  trackingCode: string,
  orderExternalId: string,
): Promise<void> {
  const templates: Record<string, string> = {
    dispatched: `Seu pedido ${orderExternalId} foi despachado! Rastreio: ${trackingCode}`,
    out_for_delivery: `Seu pedido ${orderExternalId} saiu para entrega! Rastreio: ${trackingCode}`,
    delivered: `Seu pedido ${orderExternalId} foi entregue! Obrigado pela compra.`,
  };

  try {
    const { sendWhatsAppMessageSimple } = await import("@/integrations/whatsapp/client");
    await sendWhatsAppMessageSimple({
      to: customerPhone,
      body: templates[event],
      clientId,
    });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: "whatsapp",
      operation: `tracking_${event}`,
      status: "error",
      error_message: (err as Error).message,
    });
  }
}
