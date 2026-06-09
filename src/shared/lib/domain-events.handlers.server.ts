// Side-effect module: registers domain event handlers at import time.
// Import once from server entry points (shipping, order-ingestion bootstrap).

import { onDomainEvent } from "./domain-events.server";
import { commitStock, itemsFromOrderMetadata } from "@/modules/logistics/stock-reservation.server";
import type { StockItem } from "@/modules/logistics/stock-reservation.server";
import { onOrderDelivered } from "@/modules/retention/automation-engine.server";

onDomainEvent("order.dispatched", async (payload) => {
  const clientId = String(payload.clientId ?? "");
  const items = (payload.items as StockItem[] | undefined) ?? [];
  if (!clientId || !items.length) return;
  await commitStock(clientId, items);
});

onDomainEvent("order.delivered", async (payload) => {
  const orderId = String(payload.orderId ?? "");
  if (!orderId) return;
  await onOrderDelivered(orderId);
});

// Re-export helper for typed item conversion from metadata payloads
export { itemsFromOrderMetadata };
