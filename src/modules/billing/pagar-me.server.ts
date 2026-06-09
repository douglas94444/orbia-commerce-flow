import { createSubscriptionLink } from "@/integrations/pagar-me";
import { PLAN_PRICES } from "./mercado-pago.server";

const PLAN_LABELS: Record<string, string> = {
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

export async function startPagarMeSubscription(
  clientId: string,
  plan: "launch" | "growth" | "scale",
  email: string,
  customerName: string,
): Promise<{ checkoutUrl: string }> {
  const amountCents = PLAN_PRICES[plan];
  const label = PLAN_LABELS[plan] ?? plan;

  const { checkoutUrl } = await createSubscriptionLink({
    planName: `Orbia ${label}`,
    amountCents,
    customerEmail: email,
    customerName,
    metadata: { client_id: clientId, plan },
  });

  return { checkoutUrl };
}
