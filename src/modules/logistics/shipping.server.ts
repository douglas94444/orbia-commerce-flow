import "@/shared/lib/domain-events.handlers.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { getTracking, purchaseLabel, quoteShipment } from "@/integrations/melhor-envio";
import { getServerConfig } from "@/lib/config.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { itemsFromOrderMetadata } from "./stock-reservation.server";
import type { NormalizedOrderItem } from "./order-ingestion.server";

interface OrderRow {
  id: string;
  client_id: string;
  status: string;
  nf_status: string;
  metadata: Record<string, unknown>;
  shipment_external_id: string | null;
  tracking_code: string | null;
}

async function getMelhorEnvioToken(clientId: string): Promise<string | null> {
  const { melhorEnvio } = getServerConfig();
  if (melhorEnvio.token) return melhorEnvio.token;

  const { data } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token")
    .eq("client_id", clientId)
    .eq("provider", "melhor_envio")
    .eq("is_active", true)
    .maybeSingle();

  return data?.access_token ? decryptToken(data.access_token) : null;
}

function orderItems(metadata: Record<string, unknown>): NormalizedOrderItem[] {
  return (metadata.items as NormalizedOrderItem[] | undefined) ?? [];
}

export async function dispatchOrder(orderId: string): Promise<{ trackingCode: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, status, nf_status, metadata, shipment_external_id, tracking_code")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(`Order ${orderId} not found`);

  const row = order as OrderRow;
  if (row.nf_status !== "autorizada") {
    throw new Error("NF-e deve estar autorizada antes do despacho");
  }
  if (row.status !== "separacao") {
    throw new Error(`Pedido em status "${row.status}" — esperado separacao`);
  }

  const token = await getMelhorEnvioToken(row.client_id);
  if (!token) {
    throw new Error(
      "Melhor Envio não configurado — conecte OAuth ou defina MELHOR_ENVIO_TOKEN no ambiente.",
    );
  }

  const postal = String(row.metadata.postal_code ?? "01310100");
  const quotes = await quoteShipment(token, { toPostalCode: postal, weightKg: 0.5 });
  const selected = quotes[0];
  if (!selected) {
    throw new Error("Nenhuma cotação Melhor Envio disponível para este CEP.");
  }

  let carrier = selected.company?.name ?? selected.name ?? "Melhor Envio";
  let shipmentId = String(selected.id);
  const label = await purchaseLabel(token, shipmentId);
  const trackingCode = label.tracking;
  shipmentId = label.id;

  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({
      status: "despachado",
      carrier,
      tracking_code: trackingCode,
      shipment_external_id: shipmentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateErr) throw new Error(`Failed to update order: ${updateErr.message}`);

  await supabaseAdmin.from("order_events").insert({
    order_id: orderId,
    status: "despachado",
    source: "melhor_envio",
    metadata: { tracking_code: trackingCode, shipment_id: shipmentId },
  });

  const stockItems = itemsFromOrderMetadata(orderItems(row.metadata));
  await emitDomainEvent("order.dispatched", {
    orderId,
    clientId: row.client_id,
    items: stockItems,
  });

  return { trackingCode };
}

const TRACKING_TO_STATUS: Record<string, string> = {
  posted: "despachado",
  in_transit: "em_transito",
  delivered: "entregue",
  delivered_to_receiver: "entregue",
};

export async function syncTracking(orderId: string): Promise<{ status: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, status, shipment_external_id, tracking_code")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(`Order ${orderId} not found`);

  const row = order as OrderRow;
  if (!row.shipment_external_id) {
    throw new Error("Pedido sem envio vinculado");
  }

  const token = await getMelhorEnvioToken(row.client_id);
  let trackingStatus = "in_transit";

  if (token) {
    const tracking = await getTracking(token, row.shipment_external_id);
    trackingStatus = tracking.status;
  } else if (row.status === "despachado") {
    trackingStatus = "in_transit";
  } else if (row.status === "em_transito") {
    trackingStatus = "delivered";
  }

  const newStatus = TRACKING_TO_STATUS[trackingStatus] ?? row.status;
  if (newStatus === row.status) return { status: row.status };

  await supabaseAdmin
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  await supabaseAdmin.from("order_events").insert({
    order_id: orderId,
    status: newStatus,
    source: "melhor_envio",
    metadata: { tracking_status: trackingStatus },
  });

  if (newStatus === "entregue") {
    await emitDomainEvent("order.delivered", { orderId, clientId: row.client_id });
  }

  return { status: newStatus };
}

export async function handleMelhorEnvioWebhook(payload: unknown): Promise<void> {
  const body = payload as Record<string, unknown>;
  const tracking = String(body.tracking ?? body.tracking_code ?? "");
  const shipmentId = String(body.shipment_id ?? body.id ?? "");
  const statusRaw = String(body.status ?? body.event ?? "").toLowerCase();

  if (!tracking && !shipmentId) return;

  const query = supabaseAdmin.from("orders").select("id, client_id, status");

  const { data: orders } = tracking
    ? await query.eq("tracking_code", tracking)
    : await query.eq("shipment_external_id", shipmentId);

  const order = orders?.[0] as { id: string; client_id: string; status: string } | undefined;
  if (!order) return;

  const newStatus =
    statusRaw.includes("deliver") ? "entregue" : statusRaw.includes("transit") ? "em_transito" : null;

  if (!newStatus || newStatus === order.status) return;

  await supabaseAdmin
    .from("orders")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", order.id);

  await supabaseAdmin.from("order_events").insert({
    order_id: order.id,
    status: newStatus,
    source: "melhor_envio_webhook",
    metadata: { raw_status: statusRaw },
  });

  if (newStatus === "entregue") {
    await emitDomainEvent("order.delivered", { orderId: order.id, clientId: order.client_id });
  }
}
