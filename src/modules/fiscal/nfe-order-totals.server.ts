import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";

export interface OrderTotalsMeta {
  shippingCents: number;
  discountCents: number;
  itemsSubtotalCents: number;
}

export function extractOrderTotalsFromMetadata(
  metadata: Record<string, unknown>,
  valueCents: number,
  items: NormalizedOrderItem[],
): OrderTotalsMeta {
  const shippingCents = Number(metadata.shipping_cents ?? metadata.freight_cents ?? 0) || 0;
  const discountCents = Number(metadata.discount_cents ?? 0) || 0;
  const itemsSubtotalCents = items.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0,
  );

  return { shippingCents, discountCents, itemsSubtotalCents: itemsSubtotalCents || valueCents };
}

export function validateOrderTotals(
  totals: OrderTotalsMeta,
  valueCents: number,
  hasBreakdown: boolean,
  toleranceCents = 5,
): void {
  if (!hasBreakdown) return;
  const expected = totals.itemsSubtotalCents + totals.shippingCents - totals.discountCents;
  if (Math.abs(expected - valueCents) > toleranceCents) {
    throw new Error(
      `Total do pedido (${valueCents}) diverge de itens+frete-desconto (${expected})`,
    );
  }
}

export function resolveModalidadeFrete(shippingCents: number): string {
  return shippingCents > 0 ? "0" : "9";
}
