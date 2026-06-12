import { mlFetch, getMe } from "@/integrations/mercado-livre/client";
import { callClaude } from "@/integrations/claude/client.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import { snapshotOrderFees } from "./channel-profitability.server";
import { getMarketplaceConnection } from "./_oauth.server";

export interface MlListingUpdate {
  title?: string;
  priceCents?: number;
  availableQuantity?: number;
  status?: "active" | "paused";
}

export interface MlQuestion {
  id: number;
  text: string;
  itemId: string;
  itemTitle: string;
  status: string;
  dateCreated: string;
}

export interface MlReputationMetrics {
  levelId: string | null;
  powerSellerStatus: string | null;
  transactions: { completed: number; canceled: number; total: number };
  metrics: { claims: number; delayedHandling: number; cancellations: number };
}

export interface MlComplaintAlert {
  claimId: string;
  resource: string;
  status: string;
  reason: string;
}

interface MlQuestionsResponse {
  questions: Array<{
    id: number;
    text: string;
    item_id: string;
    status: string;
    date_created: string;
  }>;
}

interface MlItemBrief {
  id: string;
  title: string;
}

async function getMlUserId(clientId: string, token: string): Promise<string> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  const cached = conn?.metadata.ml_user_id;
  if (typeof cached === "string" && cached) return cached;

  const me = await getMe(token);
  await supabaseAdmin
    .from("oauth_connections")
    .update({
      metadata: { ...(conn?.metadata ?? {}), ml_user_id: String(me.id) },
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("provider", "mercado_livre");

  return String(me.id);
}

export async function syncMlListing(
  clientId: string,
  itemId: string,
  update: MlListingUpdate,
): Promise<void> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) throw new Error("Mercado Livre não conectado");

  const body: Record<string, unknown> = {};
  if (update.title) body.title = update.title;
  if (update.priceCents != null) body.price = update.priceCents / 100;
  if (update.availableQuantity != null) body.available_quantity = update.availableQuantity;
  if (update.status === "paused") body.status = "paused";
  if (update.status === "active") body.status = "active";

  await mlFetch(`/items/${itemId}`, conn.accessToken, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  await supabaseAdmin
    .from("channel_listings")
    .update({
      listing_status: update.status ?? "active",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("channel", "mercado_livre")
    .eq("external_product_id", itemId);

  await logIntegration({
    client_id: clientId,
    provider: "mercado_livre",
    operation: "sync_listing",
    status: "success",
    metadata: { itemId, update },
  });
}

export async function fetchMlQuestions(clientId: string): Promise<MlQuestion[]> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) return [];

  const userId = await getMlUserId(clientId, conn.accessToken);
  const res = await mlFetch<MlQuestionsResponse>(
    `/questions/search?seller_id=${userId}&status=UNANSWERED&limit=50`,
    conn.accessToken,
  );

  const questions: MlQuestion[] = [];
  for (const q of res.questions ?? []) {
    let itemTitle = q.item_id;
    try {
      const item = await mlFetch<MlItemBrief>(`/items/${q.item_id}`, conn.accessToken);
      itemTitle = item.title;
    } catch {
      /* item may be unavailable */
    }
    questions.push({
      id: q.id,
      text: q.text,
      itemId: q.item_id,
      itemTitle,
      status: q.status,
      dateCreated: q.date_created,
    });
  }
  return questions;
}

export async function suggestMlAnswer(
  questionText: string,
  productTitle: string,
  productDescription?: string,
): Promise<string> {
  const prompt = [
    "Você é um vendedor profissional no Mercado Livre.",
    `Produto: ${productTitle}`,
    productDescription ? `Descrição: ${productDescription}` : "",
    `Pergunta do comprador: ${questionText}`,
    "Responda de forma clara, cordial e objetiva em português brasileiro (máx. 500 caracteres).",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    return await callClaude(
      prompt,
      "Responda apenas com o texto da resposta, sem prefixos ou explicações.",
    );
  } catch {
    return "Olá! Obrigado pela pergunta. Estamos verificando e retornaremos em breve.";
  }
}

export async function fetchMlReputation(clientId: string): Promise<MlReputationMetrics | null> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) return null;

  const userId = await getMlUserId(clientId, conn.accessToken);
  const rep = await mlFetch<{
    seller_reputation?: {
      level_id?: string;
      power_seller_status?: string;
      transactions?: { completed?: number; canceled?: number; total?: number };
      metrics?: { claims?: { rate?: number; value?: number }; delayed_handling_time?: { rate?: number }; cancellations?: { rate?: number } };
    };
  }>(`/users/${userId}`, conn.accessToken);

  const sr = rep.seller_reputation;
  return {
    levelId: sr?.level_id ?? null,
    powerSellerStatus: sr?.power_seller_status ?? null,
    transactions: {
      completed: sr?.transactions?.completed ?? 0,
      canceled: sr?.transactions?.canceled ?? 0,
      total: sr?.transactions?.total ?? 0,
    },
    metrics: {
      claims: sr?.metrics?.claims?.value ?? 0,
      delayedHandling: sr?.metrics?.delayed_handling_time?.rate ?? 0,
      cancellations: sr?.metrics?.cancellations?.rate ?? 0,
    },
  };
}

export async function splitMlFullStock(
  clientId: string,
  itemId: string,
  fullQty: number,
  regularQty: number,
): Promise<{ fullQty: number; regularQty: number }> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) throw new Error("Mercado Livre não conectado");

  await mlFetch(`/items/${itemId}`, conn.accessToken, {
    method: "PUT",
    body: JSON.stringify({
      available_quantity: regularQty,
      shipping: { mode: "me2", local_pick_up: false },
    }),
  });

  try {
    await mlFetch(`/items/${itemId}/fulfillment/stock`, conn.accessToken, {
      method: "PUT",
      body: JSON.stringify({ quantity: fullQty }),
    });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: "mercado_livre",
      operation: "ml_full_stock_split",
      status: "error",
      error_message: (err as Error).message,
      metadata: { itemId, fullQty, regularQty },
    });
  }

  await supabaseAdmin
    .from("channel_listings")
    .update({
      metadata: { ml_full_qty: fullQty, ml_regular_qty: regularQty },
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("channel", "mercado_livre")
    .eq("external_product_id", itemId);

  return { fullQty, regularQty };
}

export async function checkMlComplaints(clientId: string): Promise<MlComplaintAlert[]> {
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) return [];

  const userId = await getMlUserId(clientId, conn.accessToken);
  const claims = await mlFetch<{ data?: Array<Record<string, unknown>> }>(
    `/post-purchase/v1/claims/search?status=opened&limit=20`,
    conn.accessToken,
  );

  const alerts: MlComplaintAlert[] = [];
  for (const claim of claims.data ?? []) {
    const claimId = String(claim.id ?? "");
    const alert: MlComplaintAlert = {
      claimId,
      resource: String(claim.resource ?? ""),
      status: String(claim.status ?? "opened"),
      reason: String(claim.reason_id ?? claim.type ?? "reclamacao"),
    };
    alerts.push(alert);

    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "marketplace",
      severity: "warning",
      title: "Reclamação Mercado Livre",
      message: `Reclamação ${claimId} aberta — ${alert.reason}`,
      is_resolved: false,
    });
  }

  await logIntegration({
    client_id: clientId,
    provider: "mercado_livre",
    operation: "check_complaints",
    status: "success",
    metadata: { userId, count: alerts.length },
  });

  return alerts;
}

export async function syncMercadoAdsSpend(clientId: string): Promise<{ spendCents: number }> {
  const end = startTimer();
  const conn = await getMarketplaceConnection(clientId, "mercado_livre");
  if (!conn) return { spendCents: 0 };

  let spendCents = 0;
  try {
    const ads = await mlFetch<{ results?: Array<{ cost?: number; metrics?: { cost?: number } }> }>(
      `/advertising/advertisers/${conn.external_account || "me"}/product_ads/campaigns/search?limit=50`,
      conn.accessToken,
    );
    for (const row of ads.results ?? []) {
      spendCents += Math.round(Number(row.metrics?.cost ?? row.cost ?? 0) * 100);
    }
  } catch {
    /* Product Ads API may not be enabled */
  }

  if (spendCents > 0) {
    await supabaseAdmin.from("campaigns").upsert(
      {
        client_id: clientId,
        name: "Mercado Ads (auto)",
        platform: "mercado_livre",
        status: "active",
        spend_cents: spendCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,platform,name" },
    );
  }

  await logIntegration({
    client_id: clientId,
    provider: "mercado_livre",
    operation: "sync_ads_spend",
    status: "success",
    duration_ms: end(),
    metadata: { spendCents },
  });

  return { spendCents };
}

export async function syncMercadoLivreAdvanced(clientId: string): Promise<{
  reputation: MlReputationMetrics | null;
  questions: number;
  complaints: number;
  adsSpendCents: number;
}> {
  const [reputation, questions, complaints, ads] = await Promise.all([
    fetchMlReputation(clientId),
    fetchMlQuestions(clientId),
    checkMlComplaints(clientId),
    syncMercadoAdsSpend(clientId),
  ]);

  return {
    reputation,
    questions: questions.length,
    complaints: complaints.length,
    adsSpendCents: ads.spendCents,
  };
}

export async function snapshotMlOrderFees(
  clientId: string,
  orderId: string,
  gmvCents: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await snapshotOrderFees(clientId, orderId, "mercado_livre", gmvCents, metadata);
}
