import type {
  NormalizedOrder,
  NormalizedOrderItem,
} from "@/modules/logistics/order-ingestion.server";

/** Instagram Commerce / Meta Shops order webhook normalizer */
export function normalizeInstagramOrder(payload: unknown): NormalizedOrder | null {
  const body = payload as Record<string, unknown>;
  const entry = ((body.entry ?? []) as Array<Record<string, unknown>>)[0];
  const changes = ((entry?.changes ?? []) as Array<Record<string, unknown>>)[0];
  const value = (changes?.value ?? body.data ?? body) as Record<string, unknown>;

  const orderId = value.id ?? value.order_id;
  if (!orderId) return null;

  const itemsRaw = (value.items ?? value.line_items ?? []) as Array<Record<string, unknown>>;
  const items = itemsRaw.map((item) => ({
    sku: String(item.retailer_id ?? item.sku ?? item.product_id ?? "IG-SKU"),
    name: String(item.name ?? item.title ?? "Produto Instagram"),
    quantity: Number(item.quantity ?? 1),
    unitPriceCents: Math.round(Number(item.price ?? item.unit_price ?? 0) * 100),
    externalProductId: String(item.product_id ?? ""),
  }));

  const ship = (value.shipping_address ?? value.ship_to ?? {}) as Record<string, unknown>;
  const status = String(value.status ?? "").toLowerCase();
  const paid = ["paid", "shipped", "completed"].includes(status);

  return {
    externalId: String(orderId),
    channel: "instagram",
    valueCents: Math.round(Number(value.total_price ?? value.grand_total ?? 0) * 100),
    city: ship.city ? String(ship.city) : null,
    paymentStatus: status === "cancelled" ? "cancelled" : paid ? "paid" : "pending",
    items: items.length
      ? items
      : [{ sku: "IG-ITEM", name: "Produto Instagram", quantity: 1, unitPriceCents: 0 }],
    shipping: {
      name: String(ship.name ?? "Cliente Instagram"),
      street: String(ship.street1 ?? ship.address ?? ""),
      number: String(ship.street2 ?? "S/N"),
      city: String(ship.city ?? ""),
      state: String(ship.state ?? ""),
      postalCode: String(ship.postal_code ?? ship.zip ?? ""),
    },
    raw: value,
  };
}
