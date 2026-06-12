import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function hashContact(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function hashDocument(document: string): string {
  const digits = document.replace(/\D/g, "");
  if (!digits) return hashContact(document);
  return createHash("sha256").update(digits).digest("hex");
}

export interface IdentityMatchInput {
  clientId: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  channel?: string | null;
  externalBuyerId?: string | null;
}

export async function findCustomerByIdentity(
  input: IdentityMatchInput,
): Promise<string | null> {
  const emailHash = input.email?.trim() ? hashContact(input.email) : null;
  const phoneHash = input.phone?.trim() ? hashContact(input.phone) : null;
  const documentHash = input.document?.trim() ? hashDocument(input.document) : null;

  if (input.channel && input.externalBuyerId) {
    const { data: link } = await supabaseAdmin
      .from("customer_channel_links")
      .select("customer_id")
      .eq("client_id", input.clientId)
      .eq("channel", input.channel)
      .eq("external_buyer_id", input.externalBuyerId)
      .maybeSingle();

    if (link?.customer_id) return link.customer_id as string;
  }

  if (documentHash) {
    const { data: byDoc } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("client_id", input.clientId)
      .eq("document_hash", documentHash)
      .is("merged_into_customer_id", null)
      .maybeSingle();
    if (byDoc?.id) return byDoc.id as string;
  }

  if (emailHash) {
    const { data: byEmail } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("client_id", input.clientId)
      .eq("email_hash", emailHash)
      .is("merged_into_customer_id", null)
      .maybeSingle();
    if (byEmail?.id) return byEmail.id as string;
  }

  if (phoneHash) {
    const { data: byPhone } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("client_id", input.clientId)
      .eq("phone_hash", phoneHash)
      .is("merged_into_customer_id", null)
      .maybeSingle();
    if (byPhone?.id) return byPhone.id as string;
  }

  return null;
}

export async function linkCustomerToChannel(input: {
  clientId: string;
  customerId: string;
  channel: string;
  externalBuyerId: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
}): Promise<void> {
  const emailHash = input.email?.trim() ? hashContact(input.email) : null;
  const phoneHash = input.phone?.trim() ? hashContact(input.phone) : null;
  const documentHash = input.document?.trim() ? hashDocument(input.document) : null;

  await supabaseAdmin.from("customer_channel_links").upsert(
    {
      client_id: input.clientId,
      customer_id: input.customerId,
      channel: input.channel,
      external_buyer_id: input.externalBuyerId,
      email_hash: emailHash,
      phone_hash: phoneHash,
      document_hash: documentHash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,channel,external_buyer_id" },
  );
}

export async function mergeCustomers(
  clientId: string,
  primaryCustomerId: string,
  duplicateCustomerId: string,
): Promise<void> {
  if (primaryCustomerId === duplicateCustomerId) return;

  const { data: primary } = await supabaseAdmin
    .from("customers")
    .select("order_count, ltv_cents")
    .eq("id", primaryCustomerId)
    .eq("client_id", clientId)
    .single();

  const { data: duplicate } = await supabaseAdmin
    .from("customers")
    .select("order_count, ltv_cents")
    .eq("id", duplicateCustomerId)
    .eq("client_id", clientId)
    .single();

  if (!primary || !duplicate) return;

  await supabaseAdmin
    .from("customers")
    .update({
      merged_into_customer_id: primaryCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", duplicateCustomerId);

  await supabaseAdmin
    .from("customers")
    .update({
      order_count: (primary.order_count ?? 0) + (duplicate.order_count ?? 0),
      ltv_cents: (primary.ltv_cents ?? 0) + (duplicate.ltv_cents ?? 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", primaryCustomerId);

  await supabaseAdmin
    .from("customer_channel_links")
    .update({ customer_id: primaryCustomerId, updated_at: new Date().toISOString() })
    .eq("customer_id", duplicateCustomerId);

  await supabaseAdmin
    .from("orders")
    .update({ customer_id: primaryCustomerId, updated_at: new Date().toISOString() })
    .eq("customer_id", duplicateCustomerId);
}

export async function reconcileCustomerIdentities(clientId: string): Promise<{
  merged: number;
  linked: number;
}> {
  let merged = 0;
  let linked = 0;

  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, email_hash, phone_hash, document_hash")
    .eq("client_id", clientId)
    .is("merged_into_customer_id", null);

  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byDocument = new Map<string, string>();

  for (const customer of customers ?? []) {
    const id = customer.id as string;

    if (customer.document_hash) {
      const existing = byDocument.get(customer.document_hash as string);
      if (existing && existing !== id) {
        await mergeCustomers(clientId, existing, id);
        merged += 1;
        continue;
      }
      byDocument.set(customer.document_hash as string, id);
    }

    if (customer.email_hash) {
      const existing = byEmail.get(customer.email_hash as string);
      if (existing && existing !== id) {
        await mergeCustomers(clientId, existing, id);
        merged += 1;
        continue;
      }
      byEmail.set(customer.email_hash as string, id);
    }

    if (customer.phone_hash) {
      const existing = byPhone.get(customer.phone_hash as string);
      if (existing && existing !== id) {
        await mergeCustomers(clientId, existing, id);
        merged += 1;
      } else {
        byPhone.set(customer.phone_hash as string, id);
      }
    }
  }

  const { data: links } = await supabaseAdmin
    .from("customer_channel_links")
    .select("id")
    .eq("client_id", clientId);

  linked = links?.length ?? 0;
  return { merged, linked };
}

export async function reconcileAllCustomerIdentities(): Promise<{
  clients: number;
  merged: number;
}> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  let merged = 0;
  for (const client of clients ?? []) {
    const result = await reconcileCustomerIdentities(client.id);
    merged += result.merged;
  }

  return { clients: clients?.length ?? 0, merged };
}
