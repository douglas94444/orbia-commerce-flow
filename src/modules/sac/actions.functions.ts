import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { inboxPriorityScore } from "./routing/sac-router.server";
import { addSacMessage } from "./tickets/ticket-factory.server";
import { canAgentTakeTicket } from "./sla/sac-sla.server";
import { suggestSacReply } from "./suggest/suggest-reply.server";

async function resolveClientId(
  supabase: { rpc: (fn: string) => Promise<{ data: string | null }> },
): Promise<string> {
  const { data: clientId } = await supabase.rpc("current_client_id");
  if (clientId) return clientId;
  throw new Error("Client context required");
}

export interface SacInboxRow {
  id: string;
  protocol: string;
  channel: string;
  category: string;
  priority: string;
  status: string;
  subject: string | null;
  customerName: string | null;
  customerPhone: string | null;
  assignedTo: string | null;
  unreadCount: number;
  slaResponseDueAt: string | null;
  createdAt: string;
  priorityScore: number;
}

export interface SacTicketDetail {
  id: string;
  protocol: string;
  channel: string;
  category: string;
  subcategory: string | null;
  priority: string;
  status: string;
  subject: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  orderId: string | null;
  assignedTo: string | null;
  slaResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  tags: string[];
  createdAt: string;
  conversationId: string | null;
  messages: SacMessageRow[];
  events: SacEventRow[];
  customerContext: SacCustomerContext | null;
}

export interface SacMessageRow {
  id: string;
  direction: string;
  body: string;
  senderType: string;
  staffName: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface SacEventRow {
  id: string;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface SacCustomerContext {
  rfmSegment: string | null;
  ltvCents: number;
  orderCount: number;
  recentOrders: Array<{ id: string; status: string; totalCents: number; createdAt: string }>;
  priorTickets: number;
}

export const listSacInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SacInboxRow[]> => {
    const clientId = await resolveClientId(context.supabase);

    const { data: tickets, error } = await context.supabase
      .from("sac_tickets")
      .select(`
        id, protocol, channel, category, priority, status, subject,
        assigned_to, sla_response_due_at, created_at, customer_id,
        sac_conversations(unread_count, customer_phone)
      `)
      .eq("client_id", clientId)
      .not("status", "in", '("closed","merged")')
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return (tickets ?? []).map((t) => {
      const conv = Array.isArray(t.sac_conversations)
        ? t.sac_conversations[0]
        : t.sac_conversations;
      return {
        id: t.id,
        protocol: t.protocol,
        channel: t.channel,
        category: t.category,
        priority: t.priority,
        status: t.status,
        subject: t.subject,
        customerName: null,
        customerPhone: (conv as { customer_phone?: string } | null)?.customer_phone ?? null,
        assignedTo: t.assigned_to,
        unreadCount: (conv as { unread_count?: number } | null)?.unread_count ?? 0,
        slaResponseDueAt: t.sla_response_due_at,
        createdAt: t.created_at,
        priorityScore: inboxPriorityScore(
          t.priority as "low" | "normal" | "high" | "urgent" | "critical",
          t.sla_response_due_at,
        ),
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  });

export const getSacTicket = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ticketId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<SacTicketDetail> => {
    const clientId = await resolveClientId(context.supabase);

    const { data: ticket, error } = await context.supabase
      .from("sac_tickets")
      .select(`
        id, protocol, channel, category, subcategory, priority, status, subject,
        customer_id, order_id, assigned_to, sla_response_due_at, sla_resolution_due_at,
        first_response_at, resolved_at, tags, created_at,
        customers(ltv_cents, rfm_segment, order_count),
        sac_conversations(id, customer_phone, customer_email)
      `)
      .eq("id", data.ticketId)
      .eq("client_id", clientId)
      .single();

    if (error || !ticket) throw new Error("Ticket não encontrado");

    const conv = Array.isArray(ticket.sac_conversations)
      ? ticket.sac_conversations[0]
      : ticket.sac_conversations;
    const customer = Array.isArray(ticket.customers) ? ticket.customers[0] : ticket.customers;

    const [{ data: messages }, { data: events }, { count: priorTickets }] = await Promise.all([
      context.supabase
        .from("sac_messages")
        .select("id, direction, body, sender_type, staff_id, created_at, read_at, profiles(full_name)")
        .eq("ticket_id", data.ticketId)
        .order("created_at"),
      context.supabase
        .from("sac_ticket_events")
        .select("id, event_type, old_value, new_value, created_at")
        .eq("ticket_id", data.ticketId)
        .order("created_at"),
      ticket.customer_id
        ? context.supabase
            .from("sac_tickets")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", ticket.customer_id)
            .neq("id", data.ticketId)
        : Promise.resolve({ count: 0 }),
    ]);

    let recentOrders: SacCustomerContext["recentOrders"] = [];
    let orderCount = 0;
    if (ticket.customer_id) {
      const { data: orders } = await context.supabase
        .from("orders")
        .select("id, status, value_cents, created_at")
        .eq("customer_id", ticket.customer_id)
        .order("created_at", { ascending: false })
        .limit(5);
      recentOrders = (orders ?? []).map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.value_cents ?? 0,
        createdAt: o.created_at,
      }));
      const { count } = await context.supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", ticket.customer_id);
      orderCount = count ?? 0;
    }

    if (conv?.id) {
      await context.supabase
        .from("sac_conversations")
        .update({ unread_count: 0 })
        .eq("id", conv.id);
      await context.supabase
        .from("sac_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conv.id)
        .is("read_at", null)
        .eq("direction", "inbound");
    }

    const cust = customer as {
      ltv_cents?: number;
      rfm_segment?: string;
      order_count?: number;
    } | null;

    return {
      id: ticket.id,
      protocol: ticket.protocol,
      channel: ticket.channel,
      category: ticket.category,
      subcategory: ticket.subcategory,
      priority: ticket.priority,
      status: ticket.status,
      subject: ticket.subject,
      customerId: ticket.customer_id,
      customerName: null,
      customerEmail: (conv as { customer_email?: string } | null)?.customer_email ?? null,
      customerPhone: (conv as { customer_phone?: string } | null)?.customer_phone ?? null,
      orderId: ticket.order_id,
      assignedTo: ticket.assigned_to,
      slaResponseDueAt: ticket.sla_response_due_at,
      slaResolutionDueAt: ticket.sla_resolution_due_at,
      firstResponseAt: ticket.first_response_at,
      resolvedAt: ticket.resolved_at,
      tags: (ticket.tags as string[]) ?? [],
      createdAt: ticket.created_at,
      conversationId: conv?.id ?? null,
      messages: (messages ?? []).map((m) => {
        const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return {
          id: m.id,
          direction: m.direction,
          body: m.body,
          senderType: m.sender_type,
          staffName: (prof as { full_name?: string } | null)?.full_name ?? null,
          createdAt: m.created_at,
          readAt: m.read_at,
        };
      }),
      events: (events ?? []).map((e) => ({
        id: e.id,
        eventType: e.event_type,
        oldValue: e.old_value,
        newValue: e.new_value,
        createdAt: e.created_at,
      })),
      customerContext: ticket.customer_id
        ? {
            rfmSegment: cust?.rfm_segment ?? null,
            ltvCents: cust?.ltv_cents ?? 0,
            orderCount: cust?.order_count ?? orderCount,
            recentOrders,
            priorTickets: priorTickets ?? 0,
          }
        : null,
    };
  });

export const assignSacTicket = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ticketId: z.string().uuid(), staffId: z.string().uuid().optional() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const staffId = data.staffId ?? context.userId;

    const canTake = await canAgentTakeTicket(clientId, staffId);
    if (!canTake) throw new Error("Limite de tickets simultâneos atingido");

    const { error } = await supabaseAdmin
      .from("sac_tickets")
      .update({ assigned_to: staffId, status: "in_progress", updated_at: new Date().toISOString() })
      .eq("id", data.ticketId)
      .eq("client_id", clientId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("sac_ticket_events").insert({
      ticket_id: data.ticketId,
      staff_id: staffId,
      event_type: "assigned",
      new_value: staffId,
    });

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "sac_ticket",
      resource_id: data.ticketId,
    });

    return { ok: true };
  });

export const replySacMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ticketId: z.string().uuid(),
      conversationId: z.string().uuid(),
      body: z.string().min(1),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);

    const { data: ticket } = await context.supabase
      .from("sac_tickets")
      .select("id, channel, first_response_at, status")
      .eq("id", data.ticketId)
      .eq("client_id", clientId)
      .single();

    if (!ticket) throw new Error("Ticket não encontrado");

    await addSacMessage({
      conversationId: data.conversationId,
      ticketId: data.ticketId,
      direction: "outbound",
      body: data.body,
      senderType: "agent",
      staffId: context.userId,
    });

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      status: ticket.status === "open" ? "in_progress" : ticket.status,
    };
    if (!ticket.first_response_at) {
      updates.first_response_at = new Date().toISOString();
    }

    await supabaseAdmin.from("sac_tickets").update(updates).eq("id", data.ticketId);

    const { data: conv } = await supabaseAdmin
      .from("sac_conversations")
      .select("customer_phone, channel")
      .eq("id", data.conversationId)
      .single();

    if (conv?.customer_phone && conv.channel === "whatsapp") {
      const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
      const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");
      const creds = await getWhatsAppCredentials(clientId);
      if (creds?.provider === "meta") {
        await sendWhatsAppMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to: conv.customer_phone,
          body: data.body,
          clientId,
        }).catch(() => undefined);
      }
    }

    return { ok: true };
  });

export const changeSacStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ticketId: z.string().uuid(),
      status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);

    const { data: prev } = await context.supabase
      .from("sac_tickets")
      .select("status")
      .eq("id", data.ticketId)
      .eq("client_id", clientId)
      .single();

    const updates: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "resolved" || data.status === "closed") {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from("sac_tickets")
      .update(updates)
      .eq("id", data.ticketId);

    if (error) throw new Error(error.message);

    await supabaseAdmin.from("sac_ticket_events").insert({
      ticket_id: data.ticketId,
      staff_id: context.userId,
      event_type: "status_change",
      old_value: prev?.status,
      new_value: data.status,
    });

    if (data.status === "closed" || data.status === "resolved") {
      const { scheduleSacCsat } = await import("./automations/sac-automations.server");
      await scheduleSacCsat(data.ticketId, clientId).catch(() => undefined);
    }

    return { ok: true };
  });

export const mergeSacTickets = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sourceTicketId: z.string().uuid(),
      targetTicketId: z.string().uuid(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);

    await supabaseAdmin
      .from("sac_tickets")
      .update({ status: "merged", merged_into_ticket_id: data.targetTicketId })
      .eq("id", data.sourceTicketId)
      .eq("client_id", clientId);

    await supabaseAdmin.from("sac_ticket_events").insert({
      ticket_id: data.sourceTicketId,
      staff_id: context.userId,
      event_type: "merged",
      new_value: data.targetTicketId,
    });

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "update",
      resource: "sac_ticket",
      resource_id: data.sourceTicketId,
    });

    return { ok: true };
  });

export const listSacQuickReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data, error } = await context.supabase
      .from("sac_quick_replies")
      .select("id, title, body, category")
      .eq("client_id", clientId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSacQuickReply = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().min(1),
      body: z.string().min(1),
      category: z.string().optional(),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    if (data.id) {
      await supabaseAdmin
        .from("sac_quick_replies")
        .update({ title: data.title, body: data.body, category: data.category })
        .eq("id", data.id)
        .eq("client_id", clientId);
    } else {
      await supabaseAdmin.from("sac_quick_replies").insert({
        client_id: clientId,
        title: data.title,
        body: data.body,
        category: data.category,
      });
    }
    return { ok: true };
  });

export const addSacInternalNote = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ticketId: z.string().uuid(), body: z.string().min(1) }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { error } = await supabaseAdmin.from("sac_internal_notes").insert({
      ticket_id: data.ticketId,
      staff_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("sac_ticket_events").insert({
      ticket_id: data.ticketId,
      staff_id: context.userId,
      event_type: "note",
      new_value: data.body.slice(0, 100),
    });

    await logAudit({
      user_id: context.userId,
      client_id: clientId,
      action: "create",
      resource: "sac_internal_note",
      resource_id: data.ticketId,
    });

    return { ok: true };
  });

export const suggestSacReplyFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ticketId: z.string().uuid() }))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const suggestion = await suggestSacReply(data.ticketId);
    return { suggestion };
  });

export const createSacReturn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ticketId: z.string().uuid(),
      orderId: z.string().uuid(),
      reason: z.string().min(1),
      items: z.array(z.object({ sku: z.string(), qty: z.number().int().positive() })),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { createReturnFromSacTicket } = await import("./returns/sac-returns.server");
    const returnId = await createReturnFromSacTicket({
      clientId,
      ticketId: data.ticketId,
      orderId: data.orderId,
      reason: data.reason,
      items: data.items,
      staffId: context.userId,
    });
    return { returnId };
  });

export const replyMlFromSac = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      ticketId: z.string().uuid(),
      claimId: z.string(),
      body: z.string().min(1),
      type: z.enum(["question", "claim"]),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { replyMlFromSacTicket } = await import("./marketplace-claims/ml-claims.server");
    await replyMlFromSacTicket({
      clientId,
      ticketId: data.ticketId,
      externalId: data.claimId,
      body: data.body,
      type: data.type,
      staffId: context.userId,
    });
    return { ok: true };
  });

export const getSacMetrics = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().int().min(7).max(90).optional() }).optional())
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { getSacMetricsSummary } = await import("./metrics/sac-metrics.server");
    return getSacMetricsSummary(clientId, data?.days ?? 30);
  });

export const listSacKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data, error } = await context.supabase
      .from("sac_knowledge_articles")
      .select("id, slug, title, category, is_public, bot_enabled, view_count, updated_at")
      .eq("client_id", clientId)
      .order("title");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSacKnowledge = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().uuid().optional(),
      slug: z.string().min(1),
      title: z.string().min(1),
      body: z.string().min(1),
      category: z.string().default("geral"),
      isPublic: z.boolean().default(false),
      botEnabled: z.boolean().default(true),
    }),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const clientId = await resolveClientId(context.supabase);
    const row = {
      client_id: clientId,
      slug: data.slug,
      title: data.title,
      body: data.body,
      category: data.category,
      is_public: data.isPublic,
      bot_enabled: data.botEnabled,
    };
    if (data.id) {
      await supabaseAdmin.from("sac_knowledge_articles").update(row).eq("id", data.id);
    } else {
      await supabaseAdmin.from("sac_knowledge_articles").insert(row);
    }
    return { ok: true };
  });

export const getSacReviewSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = await resolveClientId(context.supabase);
    const { data } = await context.supabase
      .from("cs_reviews")
      .select("rating, created_at, order_id, sac_ticket_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);
    const reviews = data ?? [];
    const avg =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 0;
    return { reviews, avgRating: Number(avg.toFixed(2)), negativeCount: reviews.filter((r) => r.rating <= 2).length };
  });
