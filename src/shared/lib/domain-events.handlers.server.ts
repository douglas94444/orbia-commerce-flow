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
  try {
    const { attributeDeliveredOrder } = await import(
      "@/modules/traffic/order-attribution.server"
    );
    await attributeDeliveredOrder(orderId);
  } catch (err) {
    console.error("[traffic] order.delivered attribution:", err);
  }
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

onDomainEvent("return.rejected", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const returnRequestId = String(payload.returnRequestId ?? "");
  if (!clientId) return;

  try {
    const { sendWhatsAppToClient } = await import(
      "@/modules/logistics/notifications/whatsapp-alerts.server"
    );
    const reason = payload.reason ? ` Motivo: ${String(payload.reason)}` : "";
    await sendWhatsAppToClient(
      clientId,
      `❌ Solicitação de devolução ${returnRequestId.slice(0, 8)} foi rejeitada.${reason}`,
    );
  } catch (err) {
    console.error("[returns] return.rejected notification:", err);
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

  if (destination !== "reintegrate" || !returnRequestId) return;

  try {
    const { emitNfeForReturn } = await import("@/modules/fiscal/emit-return-nfe.server");
    await emitNfeForReturn(returnRequestId);
  } catch (err) {
    console.error("[fiscal] return NF-e:", err);
  }

  const { data: req } = await supabaseAdmin
    .from("return_requests")
    .select("refund_cents, resolution, order_id, customer_id, orders(value_cents)")
    .eq("id", returnRequestId)
    .maybeSingle();

  if (!req) return;

  const resolution = String(req.resolution ?? "refund");
  const orderId = String(req.order_id ?? "");
  const refundCents =
    (req.refund_cents as number | null) ??
    ((req.orders as { value_cents: number } | null)?.value_cents ?? 0);

  try {
    if (resolution === "exchange") {
      const { createExchangeOrder } = await import(
        "@/modules/logistics/returns/exchange-order.server"
      );
      await createExchangeOrder(returnRequestId);
    } else if (resolution === "store_credit" && refundCents > 0) {
      const { issueStoreCredit } = await import(
        "@/modules/logistics/returns/store-credit.server"
      );
      await issueStoreCredit({
        clientId,
        customerId: (req.customer_id as string | null) ?? null,
        amountCents: refundCents,
        returnRequestId,
      });
    } else if (refundCents > 0) {
      const { processReturnRefund } = await import(
        "@/modules/billing/fulfillment-billing.server"
      );
      await processReturnRefund(clientId, returnRequestId, orderId, refundCents);
    }
  } catch (err) {
    console.error("[returns] post-inspection resolution:", err);
  }
});

onDomainEvent("picking.completed", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const orderId = String(payload.orderId ?? "");
  const hasIssue = Boolean(payload.hasIssue);
  if (!clientId || !orderId) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("external_id")
    .eq("id", orderId)
    .maybeSingle();

  const label = order?.external_id ?? orderId.slice(0, 8);
  const message = hasIssue
    ? `⚠️ Picking do pedido ${label} concluído com itens não encontrados. Revise no dashboard.`
    : `✅ Picking do pedido ${label} concluído — pronto para packing.`;

  try {
    const { sendWhatsAppToClient } = await import(
      "@/modules/logistics/notifications/whatsapp-alerts.server"
    );
    await sendWhatsAppToClient(clientId, message);
  } catch (err) {
    console.error("[picking] picking.completed notification:", err);
  }
});

onDomainEvent("receiving.completed", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const sessionId = String(payload.sessionId ?? "");
  const returnRequestId = String(payload.returnRequestId ?? "");
  if (!clientId || !sessionId) return;

  if (returnRequestId) {
    try {
      const { sendWhatsAppToClient } = await import(
        "@/modules/logistics/notifications/whatsapp-alerts.server"
      );
      await sendWhatsAppToClient(
        clientId,
        `📦 Devolução ${returnRequestId.slice(0, 8)} conferida no galpão. Aguardando inspeção de qualidade.`,
      );
    } catch (err) {
      console.error("[returns] receiving.completed return notification:", err);
    }
  }

  const { data: lines } = await supabaseAdmin
    .from("receiving_lines")
    .select("sku, expected_qty, received_qty, has_divergence")
    .eq("session_id", sessionId);

  const allLines = lines ?? [];
  const divergences = allLines.filter((l) => l.has_divergence);
  const { getServerConfig } = await import("@/lib/config.server");
  const appUrl = getServerConfig().appUrl;

  let message = `✅ Recebimento concluído no Fulfillly.\n${allLines.length} SKU(s) conferidos`;
  if (divergences.length > 0) {
    message += `, ${divergences.length} com divergência:\n`;
    for (const d of divergences.slice(0, 5)) {
      message += `• ${d.sku}: esperado ${d.expected_qty}, recebido ${d.received_qty}\n`;
    }
    if (divergences.length > 5) {
      message += `… e mais ${divergences.length - 5} item(ns)\n`;
    }
  } else {
    message += ", sem divergências.";
  }
  message += `\nDetalhes: ${appUrl}/logistics/receiving`;

  try {
    const { sendWhatsAppToClient } = await import(
      "@/modules/logistics/notifications/whatsapp-alerts.server"
    );
    await sendWhatsAppToClient(clientId, message);
  } catch (err) {
    console.error("[receiving] receiving.completed notification:", err);
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
