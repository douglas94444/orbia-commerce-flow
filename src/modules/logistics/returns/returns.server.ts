import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCarrierProvider } from "@/integrations/carriers";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { logAudit } from "@/shared/lib/logger";
import { getCarrierToken, selectBestCarrier } from "../shipping/routing-engine.server";

export async function createReturnRequest(input: {
  clientId: string;
  orderId: string;
  customerId?: string;
  reason: string;
  items: Array<{ sku: string; qty: number; orderItemId?: string }>;
  approvalMode?: "auto" | "manual";
}): Promise<string> {
  const status = input.approvalMode === "auto" ? "approved" : "pending";

  const { data, error } = await supabaseAdmin
    .from("return_requests")
    .insert({
      client_id: input.clientId,
      order_id: input.orderId,
      customer_id: input.customerId ?? null,
      reason: input.reason,
      status,
      approval_mode: input.approvalMode ?? "manual",
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

  await supabaseAdmin
    .from("return_requests")
    .update({
      return_label_url: label.labelUrl ?? null,
      tracking_code: label.trackingCode,
      status: "in_transit",
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnRequestId);

  return label.trackingCode;
}

export async function markReturnReceived(returnRequestId: string): Promise<void> {
  await supabaseAdmin
    .from("return_requests")
    .update({ status: "received", updated_at: new Date().toISOString() })
    .eq("id", returnRequestId);
}

export async function listReturnRequests(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("return_requests")
    .select("id, order_id, reason, status, tracking_code, refund_cents, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface ReturnReasonReportRow {
  reason: string;
  channel: string;
  sku: string;
  count: number;
  totalQty: number;
}

export async function getReturnReasonsReport(clientId: string): Promise<ReturnReasonReportRow[]> {
  const { data: requests, error } = await supabaseAdmin
    .from("return_requests")
    .select("reason, orders(channel), return_items(sku, qty)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const agg = new Map<string, ReturnReasonReportRow>();

  for (const req of requests ?? []) {
    const channel = String((req.orders as { channel: string } | null)?.channel ?? "desconhecido");
    const items = (req.return_items ?? []) as Array<{ sku: string; qty: number }>;
    for (const item of items) {
      const key = `${req.reason}|${channel}|${item.sku}`;
      const existing = agg.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalQty += item.qty;
      } else {
        agg.set(key, {
          reason: String(req.reason),
          channel,
          sku: item.sku,
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

  await emitDomainEvent("return.inspected", {
    returnRequestId: input.returnRequestId,
    orderId: req.order_id,
    clientId: req.client_id,
    destination: input.destination,
  });
}
