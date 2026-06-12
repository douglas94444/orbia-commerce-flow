import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCarrierProvider } from "@/integrations/carriers";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { logAudit } from "@/shared/lib/logger";
import { itemsFromOrderMetadata } from "../stock-reservation.server";
import type { NormalizedOrderItem } from "../order-ingestion.server";
import { pushOrderStatusToChannel } from "./channel-status-push.server";
import { getCarrierToken, selectBestCarrier } from "./routing-engine.server";
import { computeOrderShipmentSpecs } from "./shipment-specs.server";
import {
  applyTrackingTransition,
  normalizeCarrierStatus,
  type TrackingOrderContext,
} from "./tracking-transition.server";

interface OrderRow {
  id: string;
  client_id: string;
  external_id: string;
  channel: string;
  status: string;
  nf_status: string;
  metadata: Record<string, unknown>;
  shipment_external_id: string | null;
  tracking_code: string | null;
}

function orderItems(metadata: Record<string, unknown>): NormalizedOrderItem[] {
  return (metadata.items as NormalizedOrderItem[] | undefined) ?? [];
}

async function recordShipmentRow(input: {
  clientId: string;
  orderId: string;
  provider: string;
  trackingCode: string;
  shipmentId: string;
  labelUrl?: string;
}): Promise<void> {
  await supabaseAdmin.from("shipments").insert({
    client_id: input.clientId,
    order_id: input.orderId,
    provider: input.provider,
    tracking_code: input.trackingCode,
    shipment_external_id: input.shipmentId,
    label_url: input.labelUrl ?? null,
    status: "created",
  });
}

export async function dispatchOrder(
  orderId: string,
  userId?: string,
): Promise<{ trackingCode: string; labelUrl?: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, client_id, external_id, channel, status, nf_status, metadata, shipment_external_id, tracking_code",
    )
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(`Order ${orderId} not found`);

  const row = order as OrderRow;
  if (row.nf_status !== "autorizada") {
    throw new Error("NF-e deve estar autorizada antes do despacho");
  }
  if (!["separacao", "em_packing"].includes(row.status)) {
    throw new Error(`Pedido em status "${row.status}" — esperado separacao ou em_packing`);
  }

  const specs = await computeOrderShipmentSpecs(orderId);
  const postal = String(row.metadata.postal_code ?? "01310100");
  const quote = await selectBestCarrier(row.client_id, {
    toPostalCode: postal,
    weightKg: specs.weightKg,
    lengthCm: specs.lengthCm,
    widthCm: specs.widthCm,
    heightCm: specs.heightCm,
  });

  if (!quote) {
    throw new Error("Nenhuma transportadora disponível para este CEP.");
  }

  const provider = getCarrierProvider(quote.providerId);
  if (!provider) throw new Error(`Provider ${quote.providerId} não configurado`);

  const token = await getCarrierToken(row.client_id, quote.providerId);
  if (!token) {
    throw new Error(`Token OAuth ausente para ${quote.providerName}`);
  }

  const label = await provider.purchaseLabel(quote.externalId, token);
  const carrier = quote.providerName;
  const trackingCode = label.trackingCode;
  const shipmentId = label.shipmentId;

  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({
      status: "despachado",
      carrier,
      tracking_code: trackingCode,
      shipment_external_id: shipmentId,
      metadata: {
        ...row.metadata,
        carrier_provider_id: quote.providerId,
        shipping_cost_cents: quote.priceCents,
        label_url: label.labelUrl ?? null,
        packing_weight_kg: specs.weightKg,
        packing_length_cm: specs.lengthCm,
        packing_width_cm: specs.widthCm,
        packing_height_cm: specs.heightCm,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateErr) throw new Error(`Failed to update order: ${updateErr.message}`);

  await recordShipmentRow({
    clientId: row.client_id,
    orderId,
    provider: quote.providerId,
    trackingCode,
    shipmentId,
    labelUrl: label.labelUrl,
  });

  await supabaseAdmin.from("order_events").insert({
    order_id: orderId,
    status: "despachado",
    source: quote.providerId,
    metadata: {
      tracking_code: trackingCode,
      shipment_id: shipmentId,
      label_url: label.labelUrl ?? null,
    },
  });

  await pushOrderStatusToChannel(
    row.client_id,
    row.channel,
    row.external_id,
    "shipped",
    trackingCode,
  );

  const customerPhone = String(row.metadata.customer_phone ?? row.metadata.phone ?? "");
  if (customerPhone && !row.metadata.tracking_notified_dispatched) {
    const { sendTrackingWhatsApp } = await import("../notifications/whatsapp-alerts.server");
    await sendTrackingWhatsApp(
      row.client_id,
      customerPhone,
      "dispatched",
      trackingCode,
      row.external_id,
    );
    await supabaseAdmin
      .from("orders")
      .update({
        metadata: {
          ...row.metadata,
          carrier_provider_id: quote.providerId,
          shipping_cost_cents: quote.priceCents,
          label_url: label.labelUrl ?? null,
          packing_weight_kg: specs.weightKg,
          packing_length_cm: specs.lengthCm,
          packing_width_cm: specs.widthCm,
          packing_height_cm: specs.heightCm,
          tracking_notified_dispatched: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  }

  const stockItems = itemsFromOrderMetadata(orderItems(row.metadata));
  await emitDomainEvent("order.dispatched", {
    orderId,
    clientId: row.client_id,
    items: stockItems,
  });

  if (userId) {
    await logAudit({
      user_id: userId,
      client_id: row.client_id,
      action: "update",
      resource: "order",
      resource_id: orderId,
      new_data: { status: "despachado", tracking_code: trackingCode, carrier },
    });
  }

  return { trackingCode, labelUrl: label.labelUrl };
}

function resolveCarrierProviderId(metadata: Record<string, unknown>): string {
  const fromMeta = metadata.carrier_provider_id;
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  return "melhor_envio";
}

export async function syncOrderTracking(orderId: string): Promise<{
  status: string;
  problemRecorded: boolean;
}> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, client_id, external_id, channel, status, shipment_external_id, tracking_code, metadata",
    )
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(`Order ${orderId} not found`);

  const row = order as OrderRow & { external_id: string; channel: string };
  if (!row.shipment_external_id) {
    throw new Error("Pedido sem envio vinculado");
  }

  const providerId = resolveCarrierProviderId(row.metadata ?? {});
  const provider = getCarrierProvider(providerId);
  const token = await getCarrierToken(row.client_id, providerId);

  if (!provider || !token) {
    throw new Error(`Transportadora ${providerId} indisponível para sync`);
  }

  const tracking = await provider.getTracking(row.shipment_external_id, token);
  const prevStatus = row.status;

  const ctx: TrackingOrderContext = {
    id: row.id,
    client_id: row.client_id,
    external_id: row.external_id,
    channel: row.channel,
    status: prevStatus,
    tracking_code: row.tracking_code,
    metadata: row.metadata ?? {},
  };

  const result = await applyTrackingTransition({
    order: ctx,
    prevStatus,
    carrierStatus: tracking.status,
    source: providerId,
    eventMetadata: { tracking_status: tracking.status, carrier_provider_id: providerId },
  });

  return { status: result.finalStatus, problemRecorded: result.problemRecorded };
}

export async function handleMelhorEnvioWebhook(payload: unknown): Promise<void> {
  const body = payload as Record<string, unknown>;
  const tracking = String(body.tracking ?? body.tracking_code ?? "");
  const shipmentId = String(body.shipment_id ?? body.id ?? "");
  const statusRaw = String(body.status ?? body.event ?? "");

  if (!tracking && !shipmentId) return;

  const query = supabaseAdmin.from("orders").select(
    "id, client_id, external_id, channel, status, tracking_code, metadata",
  );

  const { data: orders } = tracking
    ? await query.eq("tracking_code", tracking)
    : await query.eq("shipment_external_id", shipmentId);

  const order = orders?.[0] as TrackingOrderContext | undefined;
  if (!order) return;

  const normalized = normalizeCarrierStatus(statusRaw);
  await applyTrackingTransition({
    order,
    prevStatus: order.status,
    carrierStatus: statusRaw,
    newStatus: normalized.orderStatus,
    source: "melhor_envio_webhook",
    eventMetadata: { raw_status: statusRaw },
  });
}
