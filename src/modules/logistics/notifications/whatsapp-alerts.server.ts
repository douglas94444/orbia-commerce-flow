import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerConfig } from "@/lib/config.server";
import { logIntegration } from "@/shared/lib/logger";

export async function sendWhatsAppToOrbiaOps(message: string): Promise<void> {
  const phone = getServerConfig().orbia.opsWhatsapp;
  if (!phone) {
    await logIntegration({
      provider: "whatsapp",
      operation: "orbia_ops_alert_skipped",
      status: "success",
      metadata: { reason: "ORBIA_OPS_WHATSAPP not configured" },
    });
    return;
  }

  try {
    const { sendWhatsAppMessageSimple } = await import("@/integrations/whatsapp/client");
    await sendWhatsAppMessageSimple({ to: phone, body: message });
  } catch (err) {
    await logIntegration({
      provider: "whatsapp",
      operation: "orbia_ops_alert",
      status: "error",
      error_message: (err as Error).message,
    });
  }
}

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

export async function sendStockCriticalWhatsApp(
  clientId: string,
  sku: string,
  available: number,
  minUnits: number,
): Promise<void> {
  await sendWhatsAppToClient(
    clientId,
    `⚠️ Estoque crítico no Fulfillly: SKU ${sku} com ${available} un. disponíveis (mínimo configurado: ${minUnits}). Reponha o estoque.`,
  );
}

export async function sendReturnLabelWhatsApp(
  clientId: string,
  customerPhone: string,
  orderExternalId: string,
  trackingCode: string,
  labelUrl: string | null,
): Promise<void> {
  const labelPart = labelUrl ? ` Etiqueta: ${labelUrl}` : "";
  const body = `Sua devolução do pedido ${orderExternalId} foi aprovada. Código de rastreio: ${trackingCode}.${labelPart}`;

  try {
    const { sendWhatsAppMessageSimple } = await import("@/integrations/whatsapp/client");
    await sendWhatsAppMessageSimple({ to: customerPhone, body, clientId });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: "whatsapp",
      operation: "return_label",
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
