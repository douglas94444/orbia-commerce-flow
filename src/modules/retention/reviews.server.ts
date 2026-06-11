import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncCustomerFromOrder } from "./customer-sync.server";
import { handleNegativeReview } from "./trigger-crons.server";
import { enrollInSequence } from "./enrollment.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";

export async function submitOrderReview(input: {
  clientId: string;
  orderId: string;
  rating: number;
  comment?: string;
  email?: string;
  phone?: string;
}): Promise<{ reviewId: string }> {
  const contact = await supabaseAdmin
    .from("orders")
    .select("id, client_id, value_cents, metadata")
    .eq("id", input.orderId)
    .eq("client_id", input.clientId)
    .single();

  if (contact.error || !contact.data) throw new Error("Pedido não encontrado");

  const meta = (contact.data.metadata ?? {}) as Record<string, unknown>;
  const email = input.email ?? (meta.customer_email ? String(meta.customer_email) : undefined);
  const phone = input.phone ?? (meta.customer_phone ? String(meta.customer_phone) : undefined);

  const customerId = await syncCustomerFromOrder({
    orderId: input.orderId,
    clientId: input.clientId,
    valueCents: contact.data.value_cents ?? 0,
    email,
    phone,
  });

  if (input.rating <= 2) {
    await emitDomainEvent("review.negative", {
      clientId: input.clientId,
      orderId: input.orderId,
      customerId: customerId ?? "",
      rating: input.rating,
      comment: input.comment,
    });
    return { reviewId: "negative-handled" };
  }

  if (customerId) {
    await enrollInSequence({
      clientId: input.clientId,
      trigger: "pedido_entregue",
      customerId,
      context: { order_id: input.orderId, rating: input.rating, thank_you: true },
    });
  }

  const { data: review } = await supabaseAdmin
    .from("cs_reviews")
    .insert({
      client_id: input.clientId,
      order_id: input.orderId,
      customer_id: customerId,
      rating: input.rating,
      comment: input.comment ?? null,
    })
    .select("id")
    .single();

  return { reviewId: review?.id ?? "" };
}

export { handleNegativeReview };
