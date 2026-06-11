import type {
  NormalizedOrder,
  NormalizedOrderItem,
} from "@/modules/logistics/order-ingestion.server";

export function normalizeAmazonOrder(payload: unknown): NormalizedOrder | null {
  const body = payload as Record<string, unknown>;
  const order = (body.Order ?? body.order ?? body.payload ?? body) as Record<string, unknown>;

  const amazonOrderId = order.AmazonOrderId ?? order.amazon_order_id ?? order.order_id;
  if (!amazonOrderId) return null;

  const status = String(order.OrderStatus ?? order.order_status ?? "").toLowerCase();
  const paid = ["unshipped", "partiallyshipped", "shipped"].includes(status.replace(/_/g, ""));
  const cancelled = status.includes("cancel");

  const itemList = (order.OrderItems ?? order.order_items ?? []) as Array<Record<string, unknown>>;
  const items: NormalizedOrderItem[] = itemList.map((item) => ({
    sku: String(item.SellerSKU ?? item.sku ?? item.ASIN ?? "AMZ-SKU"),
    name: String(item.Title ?? item.title ?? "Produto Amazon"),
    quantity: Number(item.QuantityOrdered ?? item.quantity ?? 1),
    unitPriceCents: Math.round(
      Number(item.ItemPrice?.Amount ?? item.price ?? item.unit_price ?? 0) * 100,
    ),
    externalProductId: String(item.ASIN ?? item.asin ?? ""),
  }));

  const ship = (order.ShippingAddress ?? order.shipping_address ?? {}) as Record<string, unknown>;

  return {
    externalId: String(amazonOrderId),
    channel: "amazon",
    valueCents: items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0),
    city: ship.City ? String(ship.City) : ship.city ? String(ship.city) : null,
    paymentStatus: cancelled ? "cancelled" : paid ? "paid" : "pending",
    items: items.length
      ? items
      : [{ sku: "AMZ-ITEM", name: "Produto Amazon", quantity: 1, unitPriceCents: 0 }],
    customerEmail: order.BuyerEmail ? String(order.BuyerEmail) : undefined,
    shipping: {
      name: String(ship.Name ?? ship.name ?? "Cliente Amazon"),
      street: String(ship.AddressLine1 ?? ship.address_line1 ?? ""),
      number: String(ship.AddressLine2 ?? "S/N"),
      neighborhood: String(ship.District ?? ship.district ?? ""),
      city: String(ship.City ?? ship.city ?? ""),
      state: String(ship.StateOrRegion ?? ship.state ?? ""),
      postalCode: String(ship.PostalCode ?? ship.postal_code ?? ""),
    },
    raw: order,
  };
}

export async function updateAmazonShipmentStatus(
  orderId: string,
  status: string,
  token: string,
): Promise<void> {
  const res = await fetch(`https://sellingpartnerapi-na.amazon.com/orders/v0/orders/${orderId}/shipment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-amz-access-token": token,
    },
    body: JSON.stringify({ marketplaceId: "A2Q3Y263D00KWC", shipmentStatus: status }),
  });
  if (!res.ok) throw new Error(`Amazon shipment update failed: ${res.status}`);
}
