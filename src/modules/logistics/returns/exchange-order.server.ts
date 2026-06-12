import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { logAudit } from "@/shared/lib/logger";

export async function createExchangeOrder(returnRequestId: string): Promise<string> {
  const { data: req } = await supabaseAdmin
    .from("return_requests")
    .select(
      "id, client_id, order_id, exchange_sku, exchange_qty, customer_id, orders(channel, metadata, value_cents), return_items(sku, qty)",
    )
    .eq("id", returnRequestId)
    .single();

  if (!req) throw new Error("Devolução não encontrada");

  const exchangeSku = (req.exchange_sku as string | null) ?? null;
  const exchangeQty = (req.exchange_qty as number | null) ?? 1;
  if (!exchangeSku) throw new Error("SKU de troca não informado");

  const originalOrder = req.orders as {
    channel: string;
    metadata: Record<string, unknown>;
    value_cents: number;
  };

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      client_id: req.client_id,
      external_id: `TROCA-${returnRequestId.slice(0, 8)}`,
      channel: originalOrder.channel,
      status: "aguardando_nf",
      value_cents: 0,
      metadata: {
        ...originalOrder.metadata,
        parent_return_id: returnRequestId,
        parent_order_id: req.order_id,
        exchange: true,
        exchange_sku: exchangeSku,
        exchange_qty: exchangeQty,
      },
    })
    .select("id")
    .single();

  if (error || !order) throw new Error(error?.message ?? "Falha ao criar pedido de troca");

  await supabaseAdmin.from("order_items").insert({
    order_id: order.id,
    sku: exchangeSku,
    qty: exchangeQty,
    unit_price_cents: 0,
  });

  const { reserveStock } = await import("../stock-reservation.server");
  await reserveStock(req.client_id as string, [{ sku: exchangeSku, quantity: exchangeQty }]);

  await supabaseAdmin
    .from("return_requests")
    .update({
      exchange_order_id: order.id,
      resolution: "exchange",
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnRequestId);

  await logAudit({
    user_id: "system",
    client_id: req.client_id as string,
    action: "create",
    resource: "order",
    resource_id: order.id as string,
    new_data: { type: "exchange", return_request_id: returnRequestId },
  });

  await emitDomainEvent("order.exchange_created", {
    clientId: req.client_id,
    orderId: order.id,
    returnRequestId,
  });

  return order.id as string;
}
