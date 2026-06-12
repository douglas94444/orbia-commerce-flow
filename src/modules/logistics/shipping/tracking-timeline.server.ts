import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildTrackingUrl } from "./tracking-link";
import { normalizeCarrierStatus } from "./tracking-transition.server";

export interface TrackingQueueRow {
  orderId: string;
  externalId: string;
  channel: string;
  status: string;
  carrier: string | null;
  trackingCode: string | null;
  carrierStatus: string | null;
  trackingUrl: string | null;
  updatedAt: string;
}

export interface OrderEventRow {
  id: string;
  status: string;
  source: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface TrackingStats {
  despachado: number;
  emTransito: number;
  entregue: number;
  comProblema: number;
}

export async function listTrackingQueue(
  clientId: string,
  statusFilter?: string,
): Promise<TrackingQueueRow[]> {
  let query = supabaseAdmin
    .from("orders")
    .select("id, external_id, channel, status, carrier, tracking_code, metadata, updated_at")
    .eq("client_id", clientId)
    .in("status", ["despachado", "em_transito", "entregue"])
    .not("tracking_code", "is", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const trackingCode = row.tracking_code as string | null;
    return {
      orderId: row.id as string,
      externalId: row.external_id as string,
      channel: row.channel as string,
      status: row.status as string,
      carrier: row.carrier as string | null,
      trackingCode,
      carrierStatus: (meta.carrier_status as string | undefined) ?? null,
      trackingUrl: trackingCode ? buildTrackingUrl(trackingCode, row.carrier as string) : null,
      updatedAt: row.updated_at as string,
    };
  });
}

export async function getOrderTrackingTimeline(orderId: string): Promise<{
  order: TrackingQueueRow | null;
  events: OrderEventRow[];
}> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, channel, status, carrier, tracking_code, metadata, updated_at")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    return { order: null, events: [] };
  }

  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const trackingCode = order.tracking_code as string | null;

  const { data: events } = await supabaseAdmin
    .from("order_events")
    .select("id, status, source, occurred_at, metadata")
    .eq("order_id", orderId)
    .order("occurred_at", { ascending: true });

  return {
    order: {
      orderId: order.id as string,
      externalId: order.external_id as string,
      channel: order.channel as string,
      status: order.status as string,
      carrier: order.carrier as string | null,
      trackingCode,
      carrierStatus: (meta.carrier_status as string | undefined) ?? null,
      trackingUrl: trackingCode ? buildTrackingUrl(trackingCode, order.carrier as string) : null,
      updatedAt: order.updated_at as string,
    },
    events: (events ?? []).map((e) => ({
      id: e.id as string,
      status: e.status as string,
      source: e.source as string,
      occurredAt: e.occurred_at as string,
      metadata: (e.metadata ?? {}) as Record<string, unknown>,
    })),
  };
}

export async function getTrackingStats(clientId: string): Promise<TrackingStats> {
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("status, metadata")
    .eq("client_id", clientId)
    .in("status", ["despachado", "em_transito", "entregue"]);

  let despachado = 0;
  let emTransito = 0;
  let entregue = 0;
  let comProblema = 0;

  for (const o of orders ?? []) {
    const s = o.status as string;
    if (s === "despachado") despachado += 1;
    else if (s === "em_transito") emTransito += 1;
    else if (s === "entregue") entregue += 1;

    const carrierStatus = ((o.metadata ?? {}) as Record<string, unknown>).carrier_status as
      | string
      | undefined;
    if (carrierStatus && normalizeCarrierStatus(carrierStatus).isProblem) {
      comProblema += 1;
    }
  }

  return { despachado, emTransito, entregue, comProblema };
}
