import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildEnrollmentContextForCustomer } from "./contact-resolver.server";
import { enrollInSequence, ensureDefaultSequences } from "./enrollment.server";

export type TrafficChannel = "meta" | "google" | "organico";

export function resolveTrafficChannel(input: {
  attributionSource?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  utmSource?: string | null;
  orderChannel?: string | null;
}): TrafficChannel {
  if (input.fbclid || input.attributionSource?.includes("fbclid") || input.utmSource?.includes("facebook") || input.utmSource?.includes("meta")) {
    return "meta";
  }
  if (input.gclid || input.attributionSource?.includes("gclid") || input.utmSource?.includes("google")) {
    return "google";
  }
  return "organico";
}

const TRAFFIC_TRIGGER: Record<TrafficChannel, string> = {
  meta: "primeira_compra_meta",
  google: "primeira_compra_google",
  organico: "primeira_compra_organico",
};

export async function ensureTrafficSequences(clientId: string): Promise<void> {
  const defs: Array<{ name: string; trigger: string; channel: string; key: string }> = [
    { name: "Boas-vindas Meta Ads", trigger: "primeira_compra_meta", channel: "whatsapp", key: "pedido_entregue" },
    { name: "Boas-vindas Google Ads", trigger: "primeira_compra_google", channel: "email", key: "pedido_entregue" },
    { name: "Boas-vindas Orgânico", trigger: "primeira_compra_organico", channel: "whatsapp", key: "pedido_entregue" },
  ];

  for (const def of defs) {
    const { data: existing } = await supabaseAdmin
      .from("automation_sequences")
      .select("id")
      .eq("client_id", clientId)
      .eq("trigger", def.trigger)
      .maybeSingle();

    if (existing) continue;

    const { data: seq } = await supabaseAdmin
      .from("automation_sequences")
      .insert({
        client_id: clientId,
        name: def.name,
        trigger: def.trigger,
        is_active: true,
        status: "active",
      })
      .select("id")
      .single();

    if (!seq) continue;

    await supabaseAdmin.from("automation_steps").insert({
      sequence_id: seq.id,
      channel: def.channel,
      delay_minutes: 0,
      template_key: def.key,
      sort_order: 0,
      metadata: {
        template_meta: "pedido_entregue_obrigado",
        template_google: "pedido_entregue_obrigado",
        template_organico: "pedido_entregue_obrigado",
      },
    });
  }
}

export async function enrollTrafficWelcomeOnFirstOrder(orderId: string): Promise<string | null> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, attribution_source, attribution_meta, metadata, channel")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.client_id) return null;

  const meta = (order.attribution_meta ?? {}) as Record<string, unknown>;
  const orderMeta = (order.metadata ?? {}) as Record<string, unknown>;

  let customerId: string | null = null;
  const email = orderMeta.customer_email ? String(orderMeta.customer_email).toLowerCase() : null;
  if (email) {
    const { data: c } = await supabaseAdmin
      .from("customer_contact_prefs")
      .select("customer_id")
      .eq("contact_email", email)
      .maybeSingle();
    customerId = c?.customer_id ?? null;
  }
  if (!customerId && orderMeta.customer_phone) {
    const { data: c } = await supabaseAdmin
      .from("customer_contact_prefs")
      .select("customer_id")
      .eq("contact_phone", String(orderMeta.customer_phone))
      .maybeSingle();
    customerId = c?.customer_id ?? null;
  }

  if (!customerId) return null;

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("order_count, acquisition_channel")
    .eq("id", customerId)
    .single();

  if (!customer || (customer.order_count ?? 0) !== 1) return null;

  const trafficChannel = resolveTrafficChannel({
    attributionSource: order.attribution_source as string | null,
    gclid: meta.gclid as string | null,
    fbclid: meta.fbclid as string | null,
    utmSource: meta.utm_source as string | null,
    orderChannel: order.channel as string | null,
  });

  const acquisitionChannel = customer.acquisition_channel ?? trafficChannel;

  await ensureDefaultSequences(order.client_id as string);
  await ensureTrafficSequences(order.client_id as string);

  const trigger = TRAFFIC_TRIGGER[trafficChannel];
  const context = await buildEnrollmentContextForCustomer(order.client_id as string, customerId, {
    order_id: orderId,
    acquisition_channel: acquisitionChannel,
    traffic_channel: trafficChannel,
    utm_campaign: meta.utm_campaign,
  });

  return enrollInSequence({
    clientId: order.client_id as string,
    trigger,
    customerId,
    context,
  });
}

export async function enrollAfterCampaignAttribution(orderId: string): Promise<void> {
  await enrollTrafficWelcomeOnFirstOrder(orderId);
}
