import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { pushOrderStatusToChannel } from "./channel-status-push.server";
import { sendTrackingWhatsApp } from "../notifications/whatsapp-alerts.server";

const PROBLEM_STATUSES = new Set([
  "undelivered",
  "failed",
  "returned",
  "address_not_found",
  "recipient_absent",
  "devolvido",
  "falha",
  "ausente",
  "endereco_invalido",
  "nao_entregue",
  "não_entregue",
]);

export interface NormalizedCarrierStatus {
  orderStatus: string | null;
  isProblem: boolean;
  normalizedKey: string;
}

export function normalizeCarrierStatus(raw: string): NormalizedCarrierStatus {
  const s = raw.toLowerCase().trim();
  if (!s) {
    return { orderStatus: null, isProblem: false, normalizedKey: s };
  }

  const isProblem =
    PROBLEM_STATUSES.has(s) ||
    s.includes("undeliver") ||
    s.includes("devolv") ||
    s.includes("falha") ||
    s.includes("ausente") ||
    s.includes("endereco");

  if (isProblem) {
    return { orderStatus: null, isProblem: true, normalizedKey: s };
  }

  const exact: Record<string, string> = {
    posted: "despachado",
    released: "despachado",
    shipped: "despachado",
    in_transit: "em_transito",
    em_transito: "em_transito",
    out_for_delivery: "em_transito",
    delivered: "entregue",
    delivered_to_receiver: "entregue",
    entregue: "entregue",
  };

  if (exact[s]) {
    return { orderStatus: exact[s], isProblem: false, normalizedKey: s };
  }

  if (s.includes("deliver") && !s.includes("undeliver")) {
    return { orderStatus: "entregue", isProblem: false, normalizedKey: s };
  }
  if (s.includes("transit") || s.includes("trânsito") || s.includes("trânsito")) {
    return { orderStatus: "em_transito", isProblem: false, normalizedKey: s };
  }
  if (s.includes("posted") || s.includes("shipped") || s.includes("despach")) {
    return { orderStatus: "despachado", isProblem: false, normalizedKey: s };
  }

  return { orderStatus: null, isProblem: false, normalizedKey: s };
}

export interface TrackingOrderContext {
  id: string;
  client_id: string;
  external_id: string;
  channel: string;
  status: string;
  tracking_code: string | null;
  metadata: Record<string, unknown>;
}

export interface TrackingTransitionInput {
  order: TrackingOrderContext;
  prevStatus: string;
  carrierStatus: string;
  source: string;
  newStatus?: string | null;
  eventMetadata?: Record<string, unknown>;
}

export interface TrackingTransitionResult {
  statusChanged: boolean;
  finalStatus: string;
  problemRecorded: boolean;
}

async function recordDeliveryProblem(
  orderId: string,
  clientId: string,
  incidentType: string,
): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from("delivery_incidents")
    .select("id")
    .eq("order_id", orderId)
    .eq("incident_type", incidentType)
    .eq("resolved", false)
    .maybeSingle();

  if (existing) return false;

  await supabaseAdmin.from("delivery_incidents").insert({
    order_id: orderId,
    incident_type: incidentType,
    description: `Problema de entrega detectado: ${incidentType}`,
  });

  await emitDomainEvent("order.delivery_problem", {
    orderId,
    clientId,
    incidentType,
  });

  return true;
}

export async function applyTrackingTransition(
  input: TrackingTransitionInput,
): Promise<TrackingTransitionResult> {
  const { order, prevStatus, carrierStatus, source, eventMetadata = {} } = input;
  const normalized = normalizeCarrierStatus(carrierStatus);
  const newStatus = input.newStatus ?? normalized.orderStatus ?? prevStatus;
  const statusChanged = newStatus !== prevStatus;

  const meta: Record<string, unknown> = {
    ...order.metadata,
    carrier_status: carrierStatus,
  };

  if (statusChanged) {
    await supabaseAdmin
      .from("orders")
      .update({
        status: newStatus,
        metadata: meta,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      status: newStatus,
      source,
      metadata: { carrier_status: carrierStatus, ...eventMetadata },
    });
  } else {
    await supabaseAdmin
      .from("orders")
      .update({ metadata: meta, updated_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  const customerPhone = String(meta.customer_phone ?? meta.phone ?? "");
  const trackingCode = order.tracking_code ?? "";
  let metaDirty = false;
  let problemRecorded = false;

  if (statusChanged && newStatus === "em_transito" && prevStatus === "despachado") {
    if (customerPhone && !meta.tracking_notified_out_for_delivery) {
      await sendTrackingWhatsApp(
        order.client_id,
        customerPhone,
        "out_for_delivery",
        trackingCode,
        order.external_id,
      );
      meta.tracking_notified_out_for_delivery = true;
      metaDirty = true;
    }
    if (!meta.tracking_pushed_in_transit) {
      const { pushOrderInTransitToChannel } = await import("./channel-status-push.server");
      await pushOrderInTransitToChannel(
        order.client_id,
        order.channel,
        order.external_id,
        trackingCode,
      );
      meta.tracking_pushed_in_transit = true;
      metaDirty = true;
    }
  }

  if (statusChanged && newStatus === "entregue") {
    if (!meta.order_delivered_event_sent) {
      await emitDomainEvent("order.delivered", {
        orderId: order.id,
        clientId: order.client_id,
      });
      meta.order_delivered_event_sent = true;
      metaDirty = true;
    }

    if (customerPhone && !meta.tracking_notified_delivered) {
      await sendTrackingWhatsApp(
        order.client_id,
        customerPhone,
        "delivered",
        trackingCode,
        order.external_id,
      );
      meta.tracking_notified_delivered = true;
      metaDirty = true;
    }

    if (!meta.tracking_pushed_delivered) {
      await pushOrderStatusToChannel(
        order.client_id,
        order.channel,
        order.external_id,
        "delivered",
        trackingCode,
      );
      meta.tracking_pushed_delivered = true;
      metaDirty = true;
    }
  }

  if (normalized.isProblem) {
    problemRecorded = await recordDeliveryProblem(
      order.id,
      order.client_id,
      normalized.normalizedKey,
    );
  }

  if (metaDirty) {
    await supabaseAdmin
      .from("orders")
      .update({ metadata: meta, updated_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  return { statusChanged, finalStatus: newStatus, problemRecorded };
}
