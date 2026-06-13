import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { routeInboundMessage } from "./routing/sac-router.server";

export const submitSupportForm = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      clientSlug: z.string().min(1),
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      subject: z.string().min(1),
      message: z.string().min(10),
      orderRef: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id")
      .or(`slug.eq.${data.clientSlug},name.ilike.${data.clientSlug}`)
      .limit(1)
      .maybeSingle();

    if (!client) throw new Error("Loja não encontrada");

    const fullText = [
      `Assunto: ${data.subject}`,
      data.orderRef ? `Pedido: ${data.orderRef}` : "",
      `Nome: ${data.name}`,
      data.message,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await routeInboundMessage({
      clientId: client.id,
      channel: "site_form",
      text: fullText,
      fromEmail: data.email,
      fromPhone: data.phone,
      forceHuman: true,
    });

    return { protocol: result.protocol, ticketId: result.ticketId };
  });

export const lookupSupportProtocol = createServerFn({ method: "GET" })
  .inputValidator(z.object({ protocol: z.string().min(5), email: z.string().email() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ticket } = await supabaseAdmin
      .from("sac_tickets")
      .select("id, protocol, status, category, created_at, resolved_at")
      .eq("protocol", data.protocol.toUpperCase())
      .maybeSingle();

    if (!ticket) throw new Error("Protocolo não encontrado");

    const { data: conv } = await supabaseAdmin
      .from("sac_conversations")
      .select("customer_email")
      .eq("ticket_id", ticket.id)
      .limit(1)
      .maybeSingle();

    if (conv?.customer_email?.toLowerCase() !== data.email.toLowerCase()) {
      throw new Error("Email não confere com o protocolo");
    }

    return {
      protocol: ticket.protocol,
      status: ticket.status,
      category: ticket.category,
      createdAt: ticket.created_at,
      resolvedAt: ticket.resolved_at,
    };
  });

export const getPublicKbArticle = createServerFn({ method: "GET" })
  .inputValidator(z.object({ clientSlug: z.string(), slug: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .or(`slug.eq.${data.clientSlug},name.ilike.${data.clientSlug}`)
      .limit(1)
      .maybeSingle();

    if (!client) throw new Error("Loja não encontrada");

    const { data: article } = await supabaseAdmin
      .from("sac_knowledge_articles")
      .select("id, slug, title, body, category")
      .eq("client_id", client.id)
      .eq("slug", data.slug)
      .eq("is_public", true)
      .maybeSingle();

    if (!article) throw new Error("Artigo não encontrado");

    await supabaseAdmin
      .from("sac_knowledge_articles")
      .update({ view_count: ((article as { view_count?: number }).view_count ?? 0) + 1 })
      .eq("id", article.id);

    return { ...article, clientName: client.name };
  });
