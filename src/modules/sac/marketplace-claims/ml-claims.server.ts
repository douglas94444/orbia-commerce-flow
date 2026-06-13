import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration } from "@/shared/lib/logger";
import { getMarketplaceConnection } from "@/modules/marketplaces/_oauth.server";
import { addSacMessage } from "../tickets/ticket-factory.server";
import { createSacTicket } from "../tickets/ticket-factory.server";

async function mlFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://api.mercadolibre.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`ML API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>>;
}

export async function replyMlQuestion(
  clientId: string,
  questionId: string,
  answer: string,
): Promise<void> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) throw new Error("Mercado Livre não conectado");

  await mlFetch(`/answers`, conn.accessToken, {
    method: "POST",
    body: JSON.stringify({ question_id: Number(questionId), text: answer }),
  });

  await logIntegration({
    client_id: clientId,
    provider: "mercado_livre",
    operation: "reply_question",
    status: "success",
  });
}

export async function replyMlClaim(
  clientId: string,
  claimId: string,
  message: string,
): Promise<void> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) throw new Error("Mercado Livre não conectado");

  await mlFetch(`/post-purchase/v1/claims/${claimId}/actions/send-message`, conn.accessToken, {
    method: "POST",
    body: JSON.stringify({ message }),
  });

  await logIntegration({
    client_id: clientId,
    provider: "mercado_livre",
    operation: "reply_claim",
    status: "success",
  });
}

export async function replyMlFromSacTicket(input: {
  clientId: string;
  ticketId: string;
  externalId: string;
  body: string;
  type: "question" | "claim";
  staffId: string;
}): Promise<void> {
  if (input.type === "question") {
    await replyMlQuestion(input.clientId, input.externalId, input.body);
  } else {
    await replyMlClaim(input.clientId, input.externalId, input.body);
  }

  const { data: conv } = await supabaseAdmin
    .from("sac_conversations")
    .select("id")
    .eq("ticket_id", input.ticketId)
    .limit(1)
    .maybeSingle();

  if (conv) {
    await addSacMessage({
      conversationId: conv.id,
      ticketId: input.ticketId,
      direction: "outbound",
      body: input.body,
      senderType: "agent",
      staffId: input.staffId,
    });
  }
}

export async function pollMlClaimsToSac(clientId: string): Promise<number> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) return 0;

  const claims = await mlFetch(
    "/post-purchase/v1/claims/search?status=opened&limit=20",
    conn.accessToken,
  ) as { data?: Array<Record<string, unknown>> };

  let created = 0;
  for (const claim of claims.data ?? []) {
    const claimId = String(claim.id ?? "");
    const { data: existing } = await supabaseAdmin
      .from("sac_marketplace_claims")
      .select("id")
      .eq("platform", "mercado_livre")
      .eq("external_claim_id", claimId)
      .maybeSingle();

    if (existing) continue;

    const { ticketId } = await createSacTicket({
      clientId,
      channel: "mercado_livre",
      category: "chargeback",
      priority: "high",
      sourceExternalId: claimId,
      subject: `Reclamação ML #${claimId}`,
      initialMessage: String(claim.reason ?? "Reclamação aberta no Mercado Livre"),
      metadata: { ml_claim: claim },
    });

    await supabaseAdmin.from("sac_marketplace_claims").insert({
      client_id: clientId,
      ticket_id: ticketId,
      platform: "mercado_livre",
      external_claim_id: claimId,
      deadline_at: claim.due_date ? String(claim.due_date) : null,
      amount_at_risk_cents: Number(claim.amount ?? 0) * 100,
      status: "open",
    });
    created++;
  }

  return created;
}

export async function buildMlDefenseDossier(
  clientId: string,
  orderId: string,
): Promise<Record<string, unknown>> {
  const [{ data: order }, { data: nfe }, { data: events }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("id, external_id, tracking_code, status, carrier")
      .eq("id", orderId)
      .eq("client_id", clientId)
      .single(),
    supabaseAdmin
      .from("nfe_emissions")
      .select("access_key, status, xml_storage_path")
      .eq("order_id", orderId)
      .eq("status", "autorizada")
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("order_events")
      .select("event_type, payload, created_at")
      .eq("order_id", orderId)
      .order("created_at"),
  ]);

  return {
    order,
    nfe: nfe ? { accessKey: nfe.access_key, status: nfe.status } : null,
    trackingEvents: events ?? [],
    generatedAt: new Date().toISOString(),
  };
}
