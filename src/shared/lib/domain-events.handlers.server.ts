// Side-effect module: registers domain event handlers at import time.
// Import once from server entry points (shipping, order-ingestion bootstrap).

import { onDomainEvent } from "./domain-events.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { commitStock, itemsFromOrderMetadata } from "@/modules/logistics/stock-reservation.server";
import type { StockItem } from "@/modules/logistics/stock-reservation.server";
import { recalculateClientMetrics } from "@/modules/analytics/health-score.server";
import { enqueueStockSync } from "@/modules/catalog/stock-sync-outbox.server";
import {
  onOrderDelivered,
  onOrderDispatched,
  onOrderPaid,
  onNfeAuthorized,
} from "@/modules/retention/automation-engine.server";
import { notifyCsOnOrderDelivered } from "@/modules/admin/cs-events.server";

onDomainEvent("order.dispatched", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const orderId = String(payload.orderId ?? "");
  const items = (payload.items as StockItem[] | undefined) ?? [];
  if (!clientId || !items.length) return;
  await commitStock(clientId, items);
  for (const item of items) {
    await enqueueStockSync(clientId, item.sku, `dispatch:${orderId}:${item.sku}`);
  }
});

onDomainEvent("order.paid", async (payload) => {
  const orderId = String(payload.orderId ?? "");
  const clientId = String(payload.clientId ?? "");
  if (!orderId) return;
  await onOrderPaid(orderId);

  const items = (payload.items as StockItem[] | undefined) ?? [];
  if (clientId && items.length) {
    for (const item of items) {
      try {
        await enqueueStockSync(clientId, item.sku, `paid:${orderId}:${item.sku}`);
      } catch (err) {
        console.error("[catalog] stock sync enqueue on reserve:", err);
      }
    }
  }
});

onDomainEvent("order.dispatched", async (payload) => {
  const orderId = String(payload.orderId ?? "");
  if (!orderId) return;
  try {
    await onOrderDispatched(orderId);
  } catch (err) {
    console.error("[retention] order.dispatched handler:", err);
  }
});

onDomainEvent("order.delivered", async (payload) => {
  const orderId = String(payload.orderId ?? "");
  const clientId = String(payload.clientId ?? "");
  if (!orderId) return;
  await onOrderDelivered(orderId);
  if (clientId) {
    await recalculateClientMetrics(clientId);
    await notifyCsOnOrderDelivered(orderId, clientId);
  }
});

onDomainEvent("nfe.authorized", async (payload) => {
  const orderId = String(payload.orderId ?? "");
  const danfeUrl = payload.danfeUrl ? String(payload.danfeUrl) : null;
  if (!orderId) return;
  await onNfeAuthorized(orderId, danfeUrl);
});

onDomainEvent("cart.abandoned", async (payload) => {
  const { recordAbandonedCart } = await import("@/modules/retention/trigger-crons.server");
  await recordAbandonedCart({
    clientId: String(payload.clientId ?? ""),
    email: payload.email ? String(payload.email) : undefined,
    phone: payload.phone ? String(payload.phone) : undefined,
    customerId: payload.customerId ? String(payload.customerId) : undefined,
    valueCents: Number(payload.valueCents ?? 0),
    items: (payload.items as unknown[]) ?? [],
    checkoutUrl: payload.checkoutUrl ? String(payload.checkoutUrl) : undefined,
  });
});

onDomainEvent("boleto.generated", async (payload) => {
  const { recordBoletoGenerated } = await import("@/modules/retention/trigger-crons.server");
  await recordBoletoGenerated({
    clientId: String(payload.clientId ?? ""),
    orderId: String(payload.orderId ?? ""),
    customerId: String(payload.customerId ?? ""),
    boletoUrl: String(payload.boletoUrl ?? ""),
    dueAt: String(payload.dueAt ?? ""),
  });
});

onDomainEvent("product.back_in_stock", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const sku = String(payload.sku ?? "");
  if (!clientId || !sku) return;

  const { data: items } = await supabaseAdmin
    .from("wishlist_items")
    .select("customer_id, product_name, product_image")
    .eq("client_id", clientId)
    .eq("product_sku", sku);

  const { enrollInSequence } = await import("@/modules/retention/enrollment.server");
  for (const item of items ?? []) {
    await enrollInSequence({
      clientId,
      trigger: "estoque_favorito",
      customerId: item.customer_id,
      context: {
        product_name: item.product_name,
        product_image: item.product_image,
        product_sku: sku,
      },
    });
  }
});

onDomainEvent("order.delivery_problem", async (payload) => {
  const orderId = String(payload.orderId ?? "");
  const clientId = String(payload.clientId ?? "");
  if (!orderId || !clientId) return;

  await supabaseAdmin.from("operation_alerts").insert({
    client_id: clientId,
    kind: "sla",
    severity: "critical",
    title: "Problema na entrega",
    message: `Pedido com problema de entrega: ${String(payload.incidentType ?? "desconhecido")}`,
    is_resolved: false,
  });

  const { notifyCsOnDeliveryProblem } = await import("@/modules/admin/cs-events.server");
  try {
    await notifyCsOnDeliveryProblem(orderId, clientId);
  } catch {
    // CS helper may not exist yet
  }
});

onDomainEvent("return.approved", async (payload) => {
  const returnRequestId = String(payload.returnRequestId ?? "");
  const clientId = String(payload.clientId ?? "");
  const orderId = String(payload.orderId ?? "");
  if (!returnRequestId || !clientId) return;

  try {
    const { generateReturnLabel } = await import("@/modules/logistics/returns/returns.server");
    const trackingCode = await generateReturnLabel(returnRequestId);

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("external_id, metadata")
      .eq("id", orderId)
      .maybeSingle();

    const meta = (order?.metadata ?? {}) as Record<string, unknown>;
    const phone = String(meta.customer_phone ?? meta.phone ?? "");
    if (phone) {
      const { data: req } = await supabaseAdmin
        .from("return_requests")
        .select("return_label_url")
        .eq("id", returnRequestId)
        .maybeSingle();

      const { sendReturnLabelWhatsApp } = await import(
        "@/modules/logistics/notifications/whatsapp-alerts.server"
      );
      await sendReturnLabelWhatsApp(
        clientId,
        phone,
        String(order?.external_id ?? orderId.slice(0, 8)),
        trackingCode,
        (req?.return_label_url as string | null) ?? null,
      );
    }
  } catch (err) {
    console.error("[returns] return.approved label:", err);
  }
});

onDomainEvent("return.inspected", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const returnRequestId = String(payload.returnRequestId ?? "");
  const destination = String(payload.destination ?? "");
  if (!clientId) return;

  const { recordFulfillmentUsage } = await import(
    "@/modules/logistics/forecast/volume-forecast.server"
  );
  await recordFulfillmentUsage(clientId, "returns_handled");

  if (destination === "reintegrate" && returnRequestId) {
    try {
      const { emitNfeForReturn } = await import("@/modules/fiscal/emit-return-nfe.server");
      await emitNfeForReturn(returnRequestId);
    } catch (err) {
      console.error("[fiscal] return NF-e:", err);
    }

    const { data: req } = await supabaseAdmin
      .from("return_requests")
      .select("refund_cents, orders(value_cents)")
      .eq("id", returnRequestId)
      .maybeSingle();

    const refundCents =
      (req?.refund_cents as number | null) ??
      ((req?.orders as { value_cents: number } | null)?.value_cents ?? 0);

    if (refundCents > 0) {
      try {
        const { processReturnRefund } = await import(
          "@/modules/billing/fulfillment-billing.server"
        );
        await processReturnRefund(clientId, returnRequestId, refundCents);
      } catch (err) {
        console.error("[billing] return refund:", err);
      }
    }
  }
});

onDomainEvent("review.negative", async (payload) => {
  const { handleNegativeReview } = await import("@/modules/retention/trigger-crons.server");
  await handleNegativeReview({
    clientId: String(payload.clientId ?? ""),
    orderId: String(payload.orderId ?? ""),
    customerId: String(payload.customerId ?? ""),
    rating: Number(payload.rating ?? 1),
    comment: payload.comment ? String(payload.comment) : undefined,
  });
});

// Re-export helper for typed item conversion from metadata payloads
export { itemsFromOrderMetadata };
