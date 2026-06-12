import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  findCustomerByIdentity,
  hashContact,
  hashDocument,
  linkCustomerToChannel,
} from "./customer-identity.server";

export { hashContact } from "./customer-identity.server";

export interface OrderCustomerInput {
  orderId: string;
  clientId: string;
  valueCents: number;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  acquisitionChannel?: string | null;
  externalBuyerId?: string | null;
  customerName?: string | null;
  birthday?: string | null;
  marketingOptIn?: boolean;
}

export async function syncCustomerFromOrder(input: OrderCustomerInput): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() ?? null;
  const phone = input.phone?.trim() ?? null;
  const document = input.document?.trim() ?? null;
  if (!email && !phone && !document && !input.externalBuyerId) return null;

  const existingId = await findCustomerByIdentity({
    clientId: input.clientId,
    email,
    phone,
    document,
    channel: input.acquisitionChannel,
    externalBuyerId: input.externalBuyerId,
  });

  const emailHash = email ? hashContact(email) : phone ? hashContact(`phone:${phone}`) : hashDocument(document ?? input.externalBuyerId ?? input.orderId);
  const now = new Date().toISOString();

  let customerId = existingId;

  if (existingId) {
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("order_count, ltv_cents, acquisition_channel")
      .eq("id", existingId)
      .single();

    const orderCount = (existing?.order_count ?? 0) + 1;
    const ltvCents = (existing?.ltv_cents ?? 0) + input.valueCents;

    const updatePayload: Record<string, unknown> = {
      order_count: orderCount,
      ltv_cents: ltvCents,
      last_order_at: now,
      updated_at: now,
    };
    if (phone) updatePayload.phone_hash = hashContact(phone);
    if (document) updatePayload.document_hash = hashDocument(document);
    if (input.acquisitionChannel && !existing?.acquisition_channel) {
      updatePayload.acquisition_channel = input.acquisitionChannel;
    }

    await supabaseAdmin.from("customers").update(updatePayload).eq("id", existingId);
  } else {
    const upsert: Record<string, unknown> = {
      client_id: input.clientId,
      email_hash: emailHash,
      order_count: 1,
      ltv_cents: input.valueCents,
      last_order_at: now,
      rfm_segment: "novos",
      rfm_score: "indefinido",
      updated_at: now,
    };
    if (phone) upsert.phone_hash = hashContact(phone);
    if (document) upsert.document_hash = hashDocument(document);
    if (input.acquisitionChannel) upsert.acquisition_channel = input.acquisitionChannel;

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .upsert(upsert, { onConflict: "client_id,email_hash" })
      .select("id")
      .single();

    if (error) throw new Error(`customer sync failed: ${error.message}`);
    customerId = customer.id as string;
  }

  if (!customerId) return null;

  if (input.acquisitionChannel && input.externalBuyerId) {
    await linkCustomerToChannel({
      clientId: input.clientId,
      customerId,
      channel: input.acquisitionChannel,
      externalBuyerId: input.externalBuyerId,
      email,
      phone,
      document,
    });
  }

  await supabaseAdmin
    .from("orders")
    .update({ customer_id: customerId, updated_at: now })
    .eq("id", input.orderId);

  const { data: existingCustomer } = await supabaseAdmin
    .from("customers")
    .select("order_count")
    .eq("id", customerId)
    .single();
  const isNew = (existingCustomer?.order_count ?? 0) <= 1;

  const prefsRow: Record<string, unknown> = {
    customer_id: customerId,
    updated_at: now,
  };
  if (email) prefsRow.contact_email = email;
  if (phone) prefsRow.contact_phone = phone;
  if (isNew) {
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

  return customerId;
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
  const shipping = meta.shipping as Record<string, unknown> | undefined;
  const externalBuyerId =
    meta.external_buyer_id != null
      ? String(meta.external_buyer_id)
      : meta.buyer_id != null
        ? String(meta.buyer_id)
        : null;
  const document =
    shipping?.cpf != null
      ? String(shipping.cpf)
      : shipping?.cnpj != null
        ? String(shipping.cnpj)
        : null;
  const marketingOptIn = meta.marketing_opt_in === true || meta.accepts_marketing === true;
  return syncCustomerFromOrder({
    orderId,
    clientId: contact.clientId,
    valueCents: contact.valueCents,
    email: contact.email,
    phone: contact.phone,
    document,
    acquisitionChannel: contact.channel,
    externalBuyerId,
    customerName: contact.customerName,
    birthday: contact.birthday,
    marketingOptIn: marketingOptIn ? true : undefined,
  });
}
