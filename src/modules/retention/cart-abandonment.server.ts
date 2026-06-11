import { emitDomainEvent } from "@/shared/lib/domain-events.server";

export interface AbandonedCartPayload {
  clientId: string;
  email?: string;
  phone?: string;
  customerId?: string;
  valueCents: number;
  items: unknown[];
  checkoutUrl?: string;
}

const CART_EVENT_TYPES = new Set([
  "cart/updated",
  "cart/abandoned",
  "checkout/abandoned",
  "abandoned_cart",
  "carts/update",
]);

export function isCartAbandonmentEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return CART_EVENT_TYPES.has(t) || t.includes("abandon") || t.includes("cart");
}

export function parseAbandonedCartFromWebhook(
  provider: string,
  payload: unknown,
  clientId: string,
): AbandonedCartPayload | null {
  const body = payload as Record<string, unknown>;

  if (provider === "nuvemshop") {
    const cart = (body.cart ?? body) as Record<string, unknown>;
    const contact = (cart.contact ?? body.contact ?? {}) as Record<string, unknown>;
    const items = (cart.products ?? cart.items ?? body.products ?? []) as unknown[];
    const total = Number(cart.total ?? cart.subtotal ?? body.total ?? 0);
    const valueCents = total > 1000 ? Math.round(total) : Math.round(total * 100);
    const status = String(cart.status ?? body.status ?? "").toLowerCase();
    if (status === "completed" || status === "paid") return null;

    return {
      clientId,
      email: contact.email ? String(contact.email) : undefined,
      phone: contact.phone ? String(contact.phone) : undefined,
      valueCents,
      items,
      checkoutUrl: cart.abandoned_checkout_url
        ? String(cart.abandoned_checkout_url)
        : cart.checkout_url
          ? String(cart.checkout_url)
          : undefined,
    };
  }

  if (provider === "shopify") {
    const lineItems = (body.line_items ?? []) as Array<Record<string, unknown>>;
    const customer = (body.customer ?? {}) as Record<string, unknown>;
    const total = Number(body.total_price ?? body.subtotal_price ?? 0);
    const valueCents = Math.round(parseFloat(String(total)) * 100);

    return {
      clientId,
      email: customer.email ? String(customer.email) : undefined,
      phone: customer.phone ? String(customer.phone) : undefined,
      valueCents,
      items: lineItems,
      checkoutUrl: body.abandoned_checkout_url ? String(body.abandoned_checkout_url) : undefined,
    };
  }

  return null;
}

export async function emitCartAbandoned(input: AbandonedCartPayload): Promise<void> {
  if (input.valueCents <= 0 && input.items.length === 0) return;

  await emitDomainEvent("cart.abandoned", {
    clientId: input.clientId,
    email: input.email,
    phone: input.phone,
    customerId: input.customerId,
    valueCents: input.valueCents,
    items: input.items,
    checkoutUrl: input.checkoutUrl,
  });
}
