import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enrollInSequence } from "./enrollment.server";
import { hashContact } from "./customer-sync.server";
import { buildEnrollmentContextForCustomer, persistCustomerContact } from "./contact-resolver.server";
import { processExpiringPoints, processTierReminders } from "./loyalty.server";

export async function processReactivationCrons(): Promise<{ enrolled: number }> {
  const triggers = [
    { trigger: "reativacao_30d", days: 30 },
    { trigger: "reativacao_60d", days: 60 },
    { trigger: "reativacao_90d", days: 90 },
  ] as const;

  let enrolled = 0;

  for (const { trigger, days } of triggers) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const windowStart = new Date(cutoff);
    windowStart.setDate(windowStart.getDate() - 1);

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, client_id, last_order_at, cold_list_at")
      .gte("last_order_at", windowStart.toISOString())
      .lte("last_order_at", cutoff.toISOString())
      .is("cold_list_at", null);

    for (const c of customers ?? []) {
      const context = await buildEnrollmentContextForCustomer(c.client_id, c.id, {
        last_order_at: c.last_order_at,
      });
      const id = await enrollInSequence({
        clientId: c.client_id,
        trigger,
        customerId: c.id,
        context,
      });
      if (id) enrolled += 1;

      if (trigger === "reativacao_90d" && !id) {
        await supabaseAdmin
          .from("customers")
          .update({ cold_list_at: new Date().toISOString(), rfm_segment: "perdidos" })
          .eq("id", c.id);
      }
    }
  }

  return { enrolled };
}

export async function processBirthdayCrons(): Promise<{ enrolled: number }> {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const { data: prefs } = await supabaseAdmin
    .from("customer_contact_prefs")
    .select("customer_id, birthday, customers(client_id)")
    .not("birthday", "is", null);

  let enrolled = 0;
  for (const p of prefs ?? []) {
    if (!p.birthday) continue;
    const bday = new Date(p.birthday);
    if (bday.getMonth() + 1 !== month || bday.getDate() !== day) continue;

    const customer = p.customers as { client_id: string } | null;
    if (!customer) continue;

    const context = await buildEnrollmentContextForCustomer(customer.client_id, p.customer_id, {
      coupon_valid_hours: 48,
    });
    const id = await enrollInSequence({
      clientId: customer.client_id,
      trigger: "aniversario",
      customerId: p.customer_id,
      context,
    });
    if (id) enrolled += 1;
  }

  return { enrolled };
}

export async function processFirstPurchaseAnniversary(): Promise<{ enrolled: number }> {
  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const windowStart = new Date(yearAgo);
  windowStart.setDate(windowStart.getDate() - 1);

  const { data: prefs } = await supabaseAdmin
    .from("customer_contact_prefs")
    .select("customer_id, first_purchase_at, customers(client_id)")
    .gte("first_purchase_at", windowStart.toISOString())
    .lte("first_purchase_at", yearAgo.toISOString());

  let enrolled = 0;
  for (const p of prefs ?? []) {
    const customer = p.customers as { client_id: string } | null;
    if (!customer) continue;
    const context = await buildEnrollmentContextForCustomer(customer.client_id, p.customer_id, {
      years: 1,
    });
    const id = await enrollInSequence({
      clientId: customer.client_id,
      trigger: "aniversario_cliente",
      customerId: p.customer_id,
      context,
    });
    if (id) enrolled += 1;
  }
  return { enrolled };
}

export async function processAbandonedCarts(): Promise<{ enrolled: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);

  const { data: carts } = await supabaseAdmin
    .from("abandoned_carts")
    .select("id, client_id, customer_id, value_cents, checkout_url, items, contact_email, contact_phone")
    .eq("status", "open")
    .lte("abandoned_at", oneHourAgo.toISOString());

  let enrolled = 0;
  for (const cart of carts ?? []) {
    const baseContext = {
      value_cents: cart.value_cents,
      checkout_url: cart.checkout_url,
      items: cart.items,
      cart_id: cart.id,
      email: cart.contact_email,
      phone: cart.contact_phone,
    };
    const context =
      cart.customer_id
        ? await buildEnrollmentContextForCustomer(cart.client_id, cart.customer_id, baseContext)
        : baseContext;

    const id = await enrollInSequence({
      clientId: cart.client_id,
      trigger: "carrinho_abandonado",
      customerId: cart.customer_id,
      context,
    });
    if (id) {
      enrolled += 1;
      await supabaseAdmin
        .from("abandoned_carts")
        .update({ status: "enrolled", updated_at: new Date().toISOString() })
        .eq("id", cart.id);
    }
  }
  return { enrolled };
}

export async function processBoletoReminders(): Promise<{ reminded: number }> {
  const in24h = new Date(Date.now() + 24 * 60 * 60_000);

  const { data: boletos } = await supabaseAdmin
    .from("boleto_reminders")
    .select("id, client_id, customer_id, boleto_url, due_at, order_id")
    .eq("status", "pending")
    .lte("due_at", in24h.toISOString())
    .gte("due_at", new Date().toISOString());

  let reminded = 0;
  for (const b of boletos ?? []) {
    const context = b.customer_id
      ? await buildEnrollmentContextForCustomer(b.client_id, b.customer_id, {
          boleto_url: b.boleto_url,
          due_at: b.due_at,
          order_id: b.order_id,
        })
      : { boleto_url: b.boleto_url, due_at: b.due_at, order_id: b.order_id };
    await enrollInSequence({
      clientId: b.client_id,
      trigger: "boleto_vencimento",
      customerId: b.customer_id,
      context,
    });
    reminded += 1;
  }

  const expired = await supabaseAdmin
    .from("boleto_reminders")
    .select("id, client_id, customer_id, order_id")
    .eq("status", "pending")
    .lt("due_at", new Date().toISOString());

  for (const b of expired.data ?? []) {
    let newBoletoUrl = "";
    if (b.order_id && b.customer_id) {
      try {
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("value_cents, metadata")
          .eq("id", b.order_id)
          .single();
        const meta = (order?.metadata ?? {}) as Record<string, unknown>;
        const { regenerateBoletoCharge } = await import("@/integrations/pagar-me/boleto.server");
        const regen = await regenerateBoletoCharge({
          orderId: b.order_id,
          clientId: b.client_id,
          amountCents: order?.value_cents ?? 0,
          customerEmail: String(meta.customer_email ?? ""),
          customerName: String(meta.customer_name ?? "Cliente"),
          customerDocument: String(meta.customer_document ?? meta.customer_cpf ?? "00000000000"),
        });
        newBoletoUrl = regen.boletoUrl;
        await supabaseAdmin.from("boleto_reminders").insert({
          client_id: b.client_id,
          order_id: b.order_id,
          customer_id: b.customer_id,
          boleto_url: regen.boletoUrl,
          due_at: regen.dueAt,
          status: "regenerated",
        });
      } catch (err) {
        console.error("[boleto] regenerate failed:", err);
      }
    }

    await supabaseAdmin
      .from("boleto_reminders")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", b.id);

    const expiredContext = b.customer_id
      ? await buildEnrollmentContextForCustomer(b.client_id, b.customer_id, {
          order_id: b.order_id,
          regenerate: true,
          boleto_url: newBoletoUrl,
        })
      : { order_id: b.order_id, regenerate: true, boleto_url: newBoletoUrl };
    await enrollInSequence({
      clientId: b.client_id,
      trigger: "boleto_expirado",
      customerId: b.customer_id,
      context: expiredContext,
    });
  }

  return { reminded };
}

export async function processWishlistAlerts(): Promise<{ notified: number }> {
  const { data: items } = await supabaseAdmin
    .from("wishlist_items")
    .select("id, client_id, customer_id, product_sku, product_name, product_image")
    .is("notified_at", null)
    .gte("view_count", 3);

  let notified = 0;
  for (const item of items ?? []) {
    const { data: product } = await supabaseAdmin
      .from("inventory")
      .select("units, reserved")
      .eq("client_id", item.client_id)
      .eq("sku", item.product_sku)
      .maybeSingle();

    const available = (product?.units ?? 0) - (product?.reserved ?? 0);
    if (!product || available <= 0) continue;

    const wishContext = await buildEnrollmentContextForCustomer(
      item.client_id,
      item.customer_id,
      {
        product_name: item.product_name,
        product_image: item.product_image,
        product_sku: item.product_sku,
      },
    );
    await enrollInSequence({
      clientId: item.client_id,
      trigger: "estoque_favorito",
      customerId: item.customer_id,
      context: wishContext,
    });

    await supabaseAdmin
      .from("wishlist_items")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", item.id);

    notified += 1;
  }
  return { notified };
}

export async function runRetentionCrons(): Promise<Record<string, unknown>> {
  const [reactivation, birthdays, anniversary, carts, boletos, wishlist, expiring, tiers, waTemplates, backfill] =
    await Promise.all([
      processReactivationCrons(),
      processBirthdayCrons(),
      processFirstPurchaseAnniversary(),
      processAbandonedCarts(),
      processBoletoReminders(),
      processWishlistAlerts(),
      processExpiringPoints(),
      processTierReminders(),
      import("./whatsapp-templates-sync.server").then((m) => m.syncAllWhatsAppTemplates()),
      import("./contact-backfill.server").then((m) => m.backfillAllClientContacts()),
    ]);

  return { reactivation, birthdays, anniversary, carts, boletos, wishlist, expiring, tiers, waTemplates, backfill };
}

export async function recordAbandonedCart(input: {
  clientId: string;
  email?: string;
  phone?: string;
  customerId?: string;
  valueCents: number;
  items: unknown[];
  checkoutUrl?: string;
  marketingOptIn?: boolean;
}): Promise<void> {
  await supabaseAdmin.from("abandoned_carts").insert({
    client_id: input.clientId,
    customer_id: input.customerId ?? null,
    email_hash: input.email ? hashContact(input.email) : null,
    phone_hash: input.phone ? hashContact(input.phone) : null,
    contact_email: input.email?.trim().toLowerCase() ?? null,
    contact_phone: input.phone?.trim() ?? null,
    value_cents: input.valueCents,
    items: input.items,
    checkout_url: input.checkoutUrl ?? null,
    marketing_opt_in: input.marketingOptIn ?? false,
    status: "open",
  });

  if (input.customerId && (input.email || input.phone || input.marketingOptIn)) {
    await persistCustomerContact(input.customerId, {
      email: input.email,
      phone: input.phone,
      marketingOptIn: input.marketingOptIn,
    });
  }
}

export async function handleNegativeReview(input: {
  clientId: string;
  orderId: string;
  customerId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  const { data: staff } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["orbia_admin", "orbia_staff"])
    .limit(1)
    .maybeSingle();

  let ticketId: string | null = null;
  if (staff?.id) {
    const { data: ticket } = await supabaseAdmin
      .from("cs_activities")
      .insert({
        client_id: input.clientId,
        staff_id: staff.id,
        kind: "contact",
        notes: `Avaliação ${input.rating} estrelas — pedido ${input.orderId.slice(0, 8)}. ${input.comment ?? ""}`.trim(),
        metadata: {
          order_id: input.orderId,
          customer_id: input.customerId,
          rating: input.rating,
          auto: true,
          source: "negative_review",
        },
      })
      .select("id")
      .single();
    ticketId = ticket?.id ?? null;
  }

  const { data: review } = await supabaseAdmin
    .from("cs_reviews")
    .insert({
      client_id: input.clientId,
      order_id: input.orderId,
      customer_id: input.customerId,
      rating: input.rating,
      comment: input.comment ?? null,
      ticket_id: ticketId,
      handled_at: ticketId ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  const context = await buildEnrollmentContextForCustomer(input.clientId, input.customerId, {
    order_id: input.orderId,
    rating: input.rating,
    review_id: review?.id,
  });
  await enrollInSequence({
    clientId: input.clientId,
    trigger: "avaliacao_negativa",
    customerId: input.customerId,
    context,
  });
}

export async function recordBoletoGenerated(input: {
  clientId: string;
  orderId: string;
  customerId: string;
  boletoUrl: string;
  dueAt: string;
}): Promise<void> {
  await supabaseAdmin.from("boleto_reminders").insert({
    client_id: input.clientId,
    order_id: input.orderId,
    customer_id: input.customerId,
    boleto_url: input.boletoUrl,
    due_at: input.dueAt,
    status: "pending",
  });

  const context = await buildEnrollmentContextForCustomer(input.clientId, input.customerId, {
    boleto_url: input.boletoUrl,
    due_at: input.dueAt,
    order_id: input.orderId,
  });
  await enrollInSequence({
    clientId: input.clientId,
    trigger: "boleto_gerado",
    customerId: input.customerId,
    context,
    delayMinutes: 60,
  });
}
