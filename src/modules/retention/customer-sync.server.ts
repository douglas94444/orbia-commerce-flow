import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function hashContact(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface OrderCustomerInput {
  orderId: string;
  clientId: string;
  valueCents: number;
  email?: string | null;
  phone?: string | null;
  acquisitionChannel?: string | null;
  customerName?: string | null;
  birthday?: string | null;
  marketingOptIn?: boolean;
}

export async function syncCustomerFromOrder(input: OrderCustomerInput): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() ?? null;
  const phone = input.phone?.trim() ?? null;
  if (!email && !phone) return null;

  const emailHash = email ? hashContact(email) : hashContact(`phone:${phone}`);
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("id, order_count, ltv_cents, acquisition_channel")
    .eq("client_id", input.clientId)
    .eq("email_hash", emailHash)
    .maybeSingle();

  const orderCount = (existing?.order_count ?? 0) + 1;
  const ltvCents = (existing?.ltv_cents ?? 0) + input.valueCents;

  const upsert: Record<string, unknown> = {
    client_id: input.clientId,
    email_hash: emailHash,
    order_count: orderCount,
    ltv_cents: ltvCents,
    last_order_at: now,
    updated_at: now,
  };
  if (phone) upsert.phone_hash = hashContact(phone);
  if (input.acquisitionChannel && !existing?.acquisition_channel) {
    upsert.acquisition_channel = input.acquisitionChannel;
  }
  if (!existing) {
    upsert.rfm_segment = "novos";
    upsert.rfm_score = "indefinido";
  }

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .upsert(upsert, { onConflict: "client_id,email_hash" })
    .select("id")
    .single();

  if (error) throw new Error(`customer sync failed: ${error.message}`);

  const prefsRow: Record<string, unknown> = {
    customer_id: customer.id,
    updated_at: now,
  };
  if (email) prefsRow.contact_email = email;
  if (phone) prefsRow.contact_phone = phone;
  if (!existing) {
    prefsRow.first_purchase_at = now;
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("marketing_implicit_opt_in")
      .eq("id", input.clientId)
      .single();
    const implicitOptIn = Boolean(client?.marketing_implicit_opt_in);
    const optedIn = input.marketingOptIn ?? implicitOptIn;
    if (optedIn) {
      prefsRow.marketing_opt_in = true;
      prefsRow.marketing_opt_in_at = now;
    }
  } else if (input.marketingOptIn === true) {
    prefsRow.marketing_opt_in = true;
    prefsRow.marketing_opt_in_at = now;
  }

  if (input.birthday) {
    prefsRow.birthday = input.birthday.slice(0, 10);
  }

  await supabaseAdmin
    .from("customer_contact_prefs")
    .upsert(prefsRow, { onConflict: "customer_id" });

  return customer.id;
}

export async function getOrderContact(orderId: string): Promise<{
  orderId: string;
  clientId: string;
  email: string | null;
  phone: string | null;
  customerName: string | null;
  valueCents: number;
  channel: string | null;
  trackingCode: string | null;
  metadata: Record<string, unknown>;
  birthday: string | null;
}> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, value_cents, channel, tracking_code, metadata")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(`Order ${orderId} not found`);

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const birthdayRaw = metadata.customer_birthday ?? metadata.birthday ?? metadata.customer_birth_date;
  return {
    orderId: order.id,
    clientId: order.client_id,
    email: metadata.customer_email ? String(metadata.customer_email) : null,
    phone: metadata.customer_phone ? String(metadata.customer_phone) : null,
    customerName: metadata.customer_name ? String(metadata.customer_name) : null,
    valueCents: order.value_cents ?? 0,
    channel: order.channel ?? null,
    trackingCode: order.tracking_code ?? null,
    metadata,
    birthday: birthdayRaw ? String(birthdayRaw).slice(0, 10) : null,
  };
}

export async function syncCustomerFromOrderMetadata(orderId: string): Promise<string | null> {
  const contact = await getOrderContact(orderId);
  const meta = contact.metadata;
  const marketingOptIn = meta.marketing_opt_in === true || meta.accepts_marketing === true;
  return syncCustomerFromOrder({
    orderId,
    clientId: contact.clientId,
    valueCents: contact.valueCents,
    email: contact.email,
    phone: contact.phone,
    acquisitionChannel: contact.channel,
    customerName: contact.customerName,
    birthday: contact.birthday,
    marketingOptIn: marketingOptIn ? true : undefined,
  });
}
