import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCarrierProvider } from "@/integrations/carriers";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { logAudit } from "@/shared/lib/logger";
import { getCarrierToken, selectBestCarrier } from "../shipping/routing-engine.server";
import { getReturnPolicy, type ReturnResolution } from "./return-policy.server";

export async function createReturnRequest(input: {
  clientId: string;
  orderId: string;
  customerId?: string;
  reason: string;
  items: Array<{ sku: string; qty: number; orderItemId?: string }>;
  approvalMode?: "auto" | "manual";
  requestType?: "return" | "exchange";
  exchangeSku?: string;
  exchangeQty?: number;
  resolution?: ReturnResolution;
  refundCents?: number;
}): Promise<string> {
  const policy = await getReturnPolicy(input.clientId);
  const requestType = input.requestType ?? "return";
  const resolution =
    input.resolution ??
    (requestType === "exchange" ? "exchange" : policy.defaultResolution);

  if (requestType === "exchange" && !policy.allowExchange) {
    throw new Error("Trocas não habilitadas para esta loja");
  }
  if (resolution === "store_credit" && !policy.allowStoreCredit) {
    throw new Error("Crédito em loja não habilitado para esta loja");
  }
  if (requestType === "exchange" && !input.exchangeSku) {
    throw new Error("Informe o SKU desejado na troca");
  }

  const approvalMode =
    input.approvalMode ??
    (requestType === "exchange" && policy.autoApproveExchange ? "auto" : policy.approvalMode);
  const status = approvalMode === "auto" ? "approved" : "pending";

  const { data, error } = await supabaseAdmin
    .from("return_requests")
    .insert({
      client_id: input.clientId,
      order_id: input.orderId,
      customer_id: input.customerId ?? null,
      reason: input.reason,
      status,
      approval_mode: approvalMode,
      request_type: requestType,
      exchange_sku: input.exchangeSku ?? null,
      exchange_qty: input.exchangeQty ?? null,
      resolution,
      refund_cents: input.refundCents ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  for (const item of input.items) {
    await supabaseAdmin.from("return_items").insert({
      return_request_id: data.id,
      order_item_id: item.orderItemId ?? null,
      sku: item.sku,
      qty: item.qty,
    });
  }

  if (status === "approved") {
    await emitDomainEvent("return.approved", {
      returnRequestId: data.id,
      orderId: input.orderId,
      clientId: input.clientId,
    });
  }

  return data.id as string;
}

export async function approveReturnRequest(returnRequestId: string, userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("return_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", returnRequestId)
    .select("order_id, client_id")
    .single();

  if (!data) throw new Error("Solicitação não encontrada");

  await logAudit({
    user_id: userId,
    client_id: data.client_id as string,
    action: "update",
    resource: "return_request",
    resource_id: returnRequestId,
    new_data: { status: "approved" },
  });

  await emitDomainEvent("return.approved", {
    returnRequestId,
    orderId: data.order_id,
    clientId: data.client_id,
  });

  const { createReturnReceivingAppointment } = await import("../receiving/receiving.server");
  await createReturnReceivingAppointment(
    data.client_id as string,
    returnRequestId,
  ).catch(() => null);
}

export async function generateReturnLabel(returnRequestId: string): Promise<string> {
  const { data: req } = await supabaseAdmin
    .from("return_requests")
    .select("id, client_id, order_id, orders(metadata, value_cents)")
    .eq("id", returnRequestId)
    .single();

  if (!req) throw new Error("Solicitação não encontrada");

  const order = req.orders as { metadata: Record<string, unknown> };
  const postal = String(order.metadata.postal_code ?? "01310100");
  const clientId = req.client_id as string;

  const quote = await selectBestCarrier(clientId, { toPostalCode: postal, weightKg: 0.5 });
  if (!quote) throw new Error("Sem cotação para etiqueta de devolução");

  const provider = getCarrierProvider(quote.providerId);
  const token = await getCarrierToken(clientId, quote.providerId);
  if (!provider || !token) throw new Error("Transportadora não configurada");

  const label = await provider.purchaseLabel(quote.externalId, token);

  const { data: existing } = await supabaseAdmin
    .from("return_requests")
    .select("metadata")
    .eq("id", returnRequestId)
    .single();

  const prevMeta = (existing?.metadata ?? {}) as Record<string, unknown>;

  await supabaseAdmin
    .from("return_requests")
    .update({
      return_label_url: label.labelUrl ?? null,
      tracking_code: label.trackingCode,
      status: "in_transit",
      metadata: {
        ...prevMeta,
        shipment_external_id: label.shipmentId,
        carrier_provider_id: quote.providerId,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnRequestId);

  return label.trackingCode;
}

/** Agenda conferência de devolução sem marcar como recebida (status → received só após ops). */
export async function scheduleReturnReceiving(returnRequestId: string): Promise<string> {
  const { data: req } = await supabaseAdmin
    .from("return_requests")
    .select("client_id, status, metadata")
    .eq("id", returnRequestId)
    .single();

  if (!req) throw new Error("Solicitação não encontrada");

  const status = req.status as string;
  if (!["in_transit", "approved"].includes(status)) {
    throw new Error("Devolução não está elegível para conferência");
  }

  const { data: existingAppt } = await supabaseAdmin
    .from("receiving_appointments")
    .select("id")
    .eq("return_request_id", returnRequestId)
    .in("status", ["scheduled", "in_progress"])
    .maybeSingle();

  if (existingAppt?.id) return existingAppt.id as string;

  const { createReturnReceivingAppointment } = await import("../receiving/receiving.server");
  const appointmentId = await createReturnReceivingAppointment(
    req.client_id as string,
    returnRequestId,
  );

  const meta = (req.metadata ?? {}) as Record<string, unknown>;
  await supabaseAdmin
    .from("return_requests")
    .update({
      metadata: {
        ...meta,
        receiving_scheduled: true,
        carrier_delivered_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnRequestId);

  return appointmentId;
}

/** @deprecated Use scheduleReturnReceiving — mantido para compatibilidade de API. */
export async function markReturnReceived(returnRequestId: string): Promise<string> {
  return scheduleReturnReceiving(returnRequestId);
}

export async function rejectReturnRequest(
  returnRequestId: string,
  userId: string,
  rejectReason?: string,
): Promise<void> {
  const { data: req } = await supabaseAdmin
    .from("return_requests")
    .select("client_id, status, metadata")
    .eq("id", returnRequestId)
    .single();

  if (!req) throw new Error("Solicitação não encontrada");
  if ((req.status as string) !== "pending") {
    throw new Error("Só é possível rejeitar solicitações pendentes");
  }

  const meta = (req.metadata ?? {}) as Record<string, unknown>;
  await supabaseAdmin
    .from("return_requests")
    .update({
      status: "rejected",
      metadata: { ...meta, reject_reason: rejectReason ?? null },
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnRequestId);

  await logAudit({
    user_id: userId,
    client_id: req.client_id as string,
    action: "update",
    resource: "return_request",
    resource_id: returnRequestId,
    new_data: { status: "rejected", reject_reason: rejectReason },
  });

  await emitDomainEvent("return.rejected", {
    returnRequestId,
    clientId: req.client_id,
    reason: rejectReason,
  });
}

async function markOrderAsReturned(orderId: string): Promise<void> {
  await supabaseAdmin
    .from("orders")
    .update({ status: "devolvido", updated_at: new Date().toISOString() })
    .eq("id", orderId);
}

export async function listReturnRequests(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("return_requests")
    .select(
      "id, order_id, reason, status, tracking_code, refund_cents, return_label_url, request_type, exchange_sku, exchange_qty, resolution, exchange_order_id, metadata, created_at",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setReturnRefundAmount(
  returnRequestId: string,
  refundCents: number,
  userId: string,
): Promise<void> {
  const { data } = await supabaseAdmin
    .from("return_requests")
    .update({ refund_cents: refundCents, updated_at: new Date().toISOString() })
    .eq("id", returnRequestId)
    .select("client_id")
    .single();

  if (!data) throw new Error("Solicitação não encontrada");

  await logAudit({
    user_id: userId,
    client_id: data.client_id as string,
    action: "update",
    resource: "return_request",
    resource_id: returnRequestId,
    new_data: { refund_cents: refundCents },
  });
}

export async function uploadReturnInspectionPhoto(
  clientId: string,
  returnRequestId: string,
  dataUrl: string,
): Promise<string> {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagem inválido");

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const path = `${clientId}/returns/${returnRequestId}/${Date.now()}.${ext}`;

  const { error } = await supabaseAdmin.storage.from("fulfillment-evidence").upload(path, buffer, {
    contentType: `image/${match[1]}`,
    upsert: true,
  });
  if (error) throw new Error(`Falha no upload: ${error.message}`);

  const { data: urlData } = supabaseAdmin.storage.from("fulfillment-evidence").getPublicUrl(path);
  return urlData.publicUrl;
}

export interface ReturnReasonReportRow {
  reason: string;
  channel: string;
  sku: string;
  carrier: string;
  count: number;
  totalQty: number;
}

export interface ReturnRateKpi {
  totalReturns: number;
  totalDeliveredOrders: number;
  returnRatePercent: number;
}

export async function getReturnRateKpi(clientId: string): Promise<ReturnRateKpi> {
  const [{ count: returnCount }, { count: deliveredCount }] = await Promise.all([
    supabaseAdmin
      .from("return_requests")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "entregue"),
  ]);

  const totalReturns = returnCount ?? 0;
  const totalDeliveredOrders = deliveredCount ?? 0;
  const returnRatePercent =
    totalDeliveredOrders > 0 ? Math.round((totalReturns / totalDeliveredOrders) * 1000) / 10 : 0;

  return { totalReturns, totalDeliveredOrders, returnRatePercent };
}

export async function getReturnReasonsReport(clientId: string): Promise<ReturnReasonReportRow[]> {
  const { data: requests, error } = await supabaseAdmin
    .from("return_requests")
    .select("reason, metadata, orders(channel), return_items(sku, qty)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const agg = new Map<string, ReturnReasonReportRow>();

  for (const req of requests ?? []) {
    const channel = String((req.orders as { channel: string } | null)?.channel ?? "desconhecido");
    const meta = (req.metadata ?? {}) as Record<string, unknown>;
    const carrier = String(meta.carrier_provider_id ?? "desconhecido");
    const items = (req.return_items ?? []) as Array<{ sku: string; qty: number }>;
    for (const item of items) {
      const key = `${req.reason}|${channel}|${item.sku}|${carrier}`;
      const existing = agg.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalQty += item.qty;
      } else {
        agg.set(key, {
          reason: String(req.reason),
          channel,
          sku: item.sku,
          carrier,
          count: 1,
          totalQty: item.qty,
        });
      }
    }
  }

  return [...agg.values()].sort((a, b) => b.count - a.count);
}

export async function inspectReturn(input: {
  returnRequestId: string;
  inspectorId: string;
  destination: "reintegrate" | "quarantine" | "discard";
  photoUrls?: string[];
  notes?: string;
}): Promise<void> {
  await supabaseAdmin.from("return_inspections").insert({
    return_request_id: input.returnRequestId,
    inspector_id: input.inspectorId,
    destination: input.destination,
    photo_urls: input.photoUrls ?? [],
    notes: input.notes ?? null,
  });

  const { data: req } = await supabaseAdmin
    .from("return_requests")
    .select("client_id, order_id, return_items(sku, qty)")
    .eq("id", input.returnRequestId)
    .single();

  if (!req) return;

  if (input.destination === "reintegrate") {
    for (const item of (req.return_items ?? []) as Array<{ sku: string; qty: number }>) {
      const { data: inv } = await supabaseAdmin
        .from("inventory")
        .select("units")
        .eq("client_id", req.client_id)
        .eq("sku", item.sku)
        .maybeSingle();

      if (inv) {
        await supabaseAdmin
          .from("inventory")
          .update({ units: (inv.units as number) + item.qty })
          .eq("client_id", req.client_id)
          .eq("sku", item.sku);
      }
    }
  } else if (input.destination === "quarantine") {
    for (const item of (req.return_items ?? []) as Array<{ sku: string; qty: number }>) {
      await supabaseAdmin.from("quarantine_items").insert({
        client_id: req.client_id,
        sku: item.sku,
        qty: item.qty,
        reason: `Devolução ${input.returnRequestId}`,
      });
    }
  }

  await supabaseAdmin
    .from("return_requests")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", input.returnRequestId);

  if (input.destination === "reintegrate" || input.destination === "discard") {
    await markOrderAsReturned(req.order_id as string);
  }

  await emitDomainEvent("return.inspected", {
    returnRequestId: input.returnRequestId,
    orderId: req.order_id,
    clientId: req.client_id,
    destination: input.destination,
  });
}
