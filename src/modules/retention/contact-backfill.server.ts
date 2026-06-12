import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { persistCustomerContact } from "./contact-resolver.server";

export async function backfillCustomerContacts(clientId: string): Promise<{ updated: number }> {
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("client_id", clientId);

  let updated = 0;

  for (const c of customers ?? []) {
    const { data: prefs } = await supabaseAdmin
      .from("customer_contact_prefs")
      .select("contact_email, contact_phone")
      .eq("customer_id", c.id)
      .maybeSingle();

    if (prefs?.contact_email && prefs?.contact_phone) continue;

    const emailFilter = prefs?.contact_email as string | undefined;
    let order: { metadata: unknown } | null = null;

    if (emailFilter) {
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("metadata, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      order =
        (orders ?? []).find((o) => {
          const m = (o.metadata ?? {}) as Record<string, unknown>;
          return String(m.customer_email ?? "").toLowerCase() === emailFilter.toLowerCase();
        }) ?? null;
    }

    if (!order) {
      const { data: fallback } = await supabaseAdmin
        .from("orders")
        .select("metadata")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      order = fallback;
    }

    if (!order) continue;

    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    const email = meta.customer_email ? String(meta.customer_email) : null;
    const phone = meta.customer_phone ? String(meta.customer_phone) : null;
    const birthday = meta.customer_birthday ?? meta.birthday ?? meta.customer_birth_date;

    if (!email && !phone && !birthday) continue;

    const patch: { email?: string; phone?: string } = {};
    if (email && !prefs?.contact_email) patch.email = email;
    if (phone && !prefs?.contact_phone) patch.phone = phone;

    if (patch.email || patch.phone) {
      await persistCustomerContact(c.id, patch);
      updated += 1;
    }

    if (birthday) {
      await supabaseAdmin.from("customer_contact_prefs").upsert(
        {
          customer_id: c.id,
          birthday: String(birthday).slice(0, 10),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id" },
      );
    }
  }

  return { updated };
}

export async function backfillAllClientContacts(): Promise<{ clients: number; updated: number }> {
  const { data: clients } = await supabaseAdmin.from("clients").select("id").eq("status", "active");
  let totalUpdated = 0;
  for (const c of clients ?? []) {
    const { updated } = await backfillCustomerContacts(c.id);
    totalUpdated += updated;
  }
  return { clients: clients?.length ?? 0, updated: totalUpdated };
}
