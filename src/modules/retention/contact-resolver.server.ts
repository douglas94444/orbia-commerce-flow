import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MARKETING_TRIGGERS = new Set([
  "carrinho_abandonado",
  "reativacao_30d",
  "reativacao_60d",
  "reativacao_90d",
  "reativacao_jornada",
  "aniversario",
  "aniversario_cliente",
  "pos_entrega_7d",
  "estoque_favorito",
]);

export function isMarketingTrigger(trigger: string): boolean {
  return MARKETING_TRIGGERS.has(trigger);
}

export interface ResolvedContact {
  email: string | null;
  phone: string | null;
  optedOut: string[];
  marketingOptIn: boolean;
  customerName: string | null;
}

export async function resolveCustomerContact(
  clientId: string,
  customerId: string | null,
  context: Record<string, unknown>,
): Promise<ResolvedContact> {
  let email = context.email ? String(context.email) : null;
  let phone = context.phone ? String(context.phone) : null;
  let optedOut: string[] = [];
  let marketingOptIn = false;
  let customerName = context.customer_name ? String(context.customer_name) : null;

  if (customerId) {
    const { data: prefs } = await supabaseAdmin
      .from("customer_contact_prefs")
      .select("contact_email, contact_phone, opted_out_channels, marketing_opt_in")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (prefs) {
      email = email ?? (prefs.contact_email as string | null);
      phone = phone ?? (prefs.contact_phone as string | null);
      optedOut = (prefs.opted_out_channels ?? []) as string[];
      marketingOptIn = Boolean(prefs.marketing_opt_in);
    }
  }

  if ((!email || !phone) && customerId) {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("metadata")
      .eq("client_id", clientId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (order) {
      const meta = (order.metadata ?? {}) as Record<string, unknown>;
      email = email ?? (meta.customer_email ? String(meta.customer_email) : null);
      phone = phone ?? (meta.customer_phone ? String(meta.customer_phone) : null);
      customerName = customerName ?? (meta.customer_name ? String(meta.customer_name) : null);
    }
  }

  const cartId = context.cart_id as string | undefined;
  if (cartId && (!email || !phone)) {
    const { data: cart } = await supabaseAdmin
      .from("abandoned_carts")
      .select("contact_email, contact_phone")
      .eq("id", cartId)
      .maybeSingle();
    if (cart) {
      email = email ?? (cart.contact_email as string | null);
      phone = phone ?? (cart.contact_phone as string | null);
    }
  }

  const orderId = context.order_id as string | undefined;
  if (orderId && (!email || !phone)) {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("metadata")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      const meta = (order.metadata ?? {}) as Record<string, unknown>;
      email = email ?? (meta.customer_email ? String(meta.customer_email) : null);
      phone = phone ?? (meta.customer_phone ? String(meta.customer_phone) : null);
      customerName = customerName ?? (meta.customer_name ? String(meta.customer_name) : null);
    }
  }

  return { email, phone, optedOut, marketingOptIn, customerName };
}

export async function persistCustomerContact(
  customerId: string,
  input: { email?: string | null; phone?: string | null; marketingOptIn?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = { customer_id: customerId, updated_at: new Date().toISOString() };
  if (input.email) row.contact_email = input.email.trim().toLowerCase();
  if (input.phone) row.contact_phone = input.phone.trim();
  if (input.marketingOptIn !== undefined) {
    row.marketing_opt_in = input.marketingOptIn;
    if (input.marketingOptIn) row.marketing_opt_in_at = new Date().toISOString();
  }
  await supabaseAdmin.from("customer_contact_prefs").upsert(row, { onConflict: "customer_id" });
}

export async function buildEnrollmentContextForCustomer(
  clientId: string,
  customerId: string,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const contact = await resolveCustomerContact(clientId, customerId, extra);

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("ltv_cents, acquisition_channel, rfm_segment")
    .eq("id", customerId)
    .single();

  const { data: lastOrder } = await supabaseAdmin
    .from("orders")
    .select("id, value_cents, metadata, tracking_code")
    .eq("client_id", clientId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = (lastOrder?.metadata ?? {}) as Record<string, unknown>;
  const items = (meta.items ?? []) as Array<Record<string, unknown>>;
  const firstItem = items[0];

  return {
    ...extra,
    email: contact.email,
    phone: contact.phone,
    customer_name: contact.customerName ?? meta.customer_name,
    value_cents: lastOrder?.value_cents ?? customer?.ltv_cents ?? 0,
    order_id: lastOrder?.id,
    tracking_code: lastOrder?.tracking_code,
    acquisition_channel: customer?.acquisition_channel,
    rfm_segment: customer?.rfm_segment,
    product_name: firstItem?.name ? String(firstItem.name) : firstItem?.sku ? String(firstItem.sku) : undefined,
    product_image: firstItem?.image ? String(firstItem.image) : undefined,
  };
}
