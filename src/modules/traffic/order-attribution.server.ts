import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recalculateClientMetrics } from "@/modules/analytics/health-score.server";
import type { NormalizedOrder } from "@/modules/logistics/order-ingestion.server";
import type { Json } from "@/integrations/supabase/types";

const ATTRIBUTION_WINDOW_DAYS = 7;

export interface AttributionSignals {
  utmCampaign: string | null;
  utmSource: string | null;
  gclid: string | null;
  fbclid: string | null;
  source: string;
}

function parseQueryParams(url: string): Record<string, string> {
  try {
    const q = url.includes("?") ? url.split("?")[1] : url;
    const params = new URLSearchParams(q);
    const out: Record<string, string> = {};
    params.forEach((v, k) => {
      out[k.toLowerCase()] = v;
    });
    return out;
  } catch {
    return {};
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function extractAttributionSignals(
  raw: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): AttributionSignals {
  const bag: Record<string, unknown> = { ...metadata, ...raw };

  const noteAttributes = bag.note_attributes;
  if (Array.isArray(noteAttributes)) {
    for (const attr of noteAttributes) {
      const row = attr as Record<string, unknown>;
      const name = String(row.name ?? "").toLowerCase();
      const value = row.value;
      if (typeof value === "string" && value) {
        if (name === "utm_campaign") bag.utm_campaign = value;
        if (name === "utm_source") bag.utm_source = value;
        if (name === "gclid") bag.gclid = value;
        if (name === "fbclid") bag.fbclid = value;
      }
    }
  }

  for (const urlKey of ["landing_site", "referring_site", "landing_site_ref", "source_url"]) {
    const url = bag[urlKey];
    if (typeof url === "string" && url) {
      const params = parseQueryParams(url);
      bag.utm_campaign ??= params.utm_campaign;
      bag.utm_source ??= params.utm_source;
      bag.gclid ??= params.gclid;
      bag.fbclid ??= params.fbclid;
    }
  }

  const utmCampaign = pickString(bag, ["utm_campaign", "utmCampaign", "campaign"]);
  const utmSource = pickString(bag, ["utm_source", "utmSource", "source"]);
  const gclid = pickString(bag, ["gclid"]);
  const fbclid = pickString(bag, ["fbclid"]);

  let source = "unknown";
  if (utmCampaign) source = "utm_campaign";
  else if (gclid) source = "gclid";
  else if (fbclid) source = "fbclid";
  else if (utmSource?.includes("google")) source = "utm_source_google";
  else if (utmSource?.includes("facebook") || utmSource?.includes("meta")) source = "utm_source_meta";

  return { utmCampaign, utmSource, gclid, fbclid, source };
}

export interface AttributionTouchpoint {
  type: "utm_campaign" | "gclid" | "fbclid" | "utm_source";
  value: string;
  weight: number;
}

export function buildTouchpoints(signals: AttributionSignals): AttributionTouchpoint[] {
  const points: AttributionTouchpoint[] = [];
  if (signals.utmCampaign) {
    points.push({ type: "utm_campaign", value: signals.utmCampaign, weight: 0.4 });
  }
  if (signals.gclid) {
    points.push({ type: "gclid", value: signals.gclid, weight: 0.35 });
  }
  if (signals.fbclid) {
    points.push({ type: "fbclid", value: signals.fbclid, weight: 0.35 });
  }
  if (signals.utmSource) {
    points.push({ type: "utm_source", value: signals.utmSource, weight: 0.25 });
  }
  return points;
}

export function buildAttributionMeta(signals: AttributionSignals): Record<string, unknown> {
  const touchpoints = buildTouchpoints(signals);
  return {
    utm_campaign: signals.utmCampaign,
    utm_source: signals.utmSource,
    gclid: signals.gclid,
    fbclid: signals.fbclid,
    touchpoints,
    model: "multi_touch_linear",
  };
}

async function resolveCampaignForTouchpoint(
  clientId: string,
  touch: AttributionTouchpoint,
  orderCreatedAt?: string,
): Promise<string | null> {
  const signals: AttributionSignals = {
    utmCampaign: touch.type === "utm_campaign" ? touch.value : null,
    utmSource: touch.type === "utm_source" ? touch.value : null,
    gclid: touch.type === "gclid" ? touch.value : null,
    fbclid: touch.type === "fbclid" ? touch.value : null,
    source: touch.type,
  };
  return resolveCampaignId(clientId, signals, orderCreatedAt);
}

async function resolveMultiTouchCampaign(
  clientId: string,
  signals: AttributionSignals,
  orderCreatedAt?: string,
): Promise<string | null> {
  const touchpoints = buildTouchpoints(signals);
  if (touchpoints.length === 0) {
    return resolveCampaignId(clientId, signals, orderCreatedAt);
  }

  const scores = new Map<string, number>();
  for (const touch of touchpoints) {
    const campaignId = await resolveCampaignForTouchpoint(clientId, touch, orderCreatedAt);
    if (campaignId) {
      scores.set(campaignId, (scores.get(campaignId) ?? 0) + touch.weight);
    }
  }

  let best: string | null = null;
  let bestScore = 0;
  for (const [id, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  return best ?? resolveCampaignId(clientId, signals, orderCreatedAt);
}

async function resolveCampaignId(
  clientId: string,
  signals: AttributionSignals,
  orderCreatedAt?: string,
): Promise<string | null> {
  if (signals.utmCampaign) {
    const { data: byName } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("client_id", clientId)
      .ilike("name", `%${signals.utmCampaign}%`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byName?.id) return byName.id as string;

    const { data: byExternal } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("client_id", clientId)
      .eq("external_id", signals.utmCampaign)
      .maybeSingle();
    if (byExternal?.id) return byExternal.id as string;
  }

  const platform = signals.gclid ? "google" : signals.fbclid ? "meta" : null;
  if (!platform) return null;

  const since = new Date(orderCreatedAt ?? Date.now());
  since.setDate(since.getDate() - ATTRIBUTION_WINDOW_DAYS);

  const { data: recent } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("client_id", clientId)
    .eq("platform", platform)
    .in("status", ["ativa", "atencao"])
    .gte("updated_at", since.toISOString())
    .order("spend_cents", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (recent?.id as string) ?? null;
}

export async function captureAttributionOnIngest(
  clientId: string,
  orderId: string,
  order: NormalizedOrder,
): Promise<void> {
  const signals = extractAttributionSignals(order.raw, {});
  const meta = buildAttributionMeta(signals);
  const campaignId = await resolveMultiTouchCampaign(clientId, signals);

  await supabaseAdmin
    .from("orders")
    .update({
      attribution_source: signals.source,
      attribution_meta: meta as Json,
      attributed_campaign_id: campaignId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
}

export async function attributeDeliveredOrder(orderId: string): Promise<boolean> {
  const { data: existing } = await supabaseAdmin
    .from("order_attributions")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) return false;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select(
      "id, client_id, status, value_cents, attributed_campaign_id, attribution_meta, attribution_source, created_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.status !== "entregue") return false;

  let campaignId = order.attributed_campaign_id as string | null;
  const meta = (order.attribution_meta ?? {}) as Record<string, unknown>;
  const signals: AttributionSignals = {
    utmCampaign: (meta.utm_campaign as string) ?? null,
    utmSource: (meta.utm_source as string) ?? null,
    gclid: (meta.gclid as string) ?? null,
    fbclid: (meta.fbclid as string) ?? null,
    source: (order.attribution_source as string) ?? "unknown",
  };

  if (!campaignId) {
    campaignId = await resolveMultiTouchCampaign(
      order.client_id as string,
      signals,
      order.created_at as string,
    );
  }

  if (!campaignId) return false;

  const valueCents = order.value_cents as number;
  if (valueCents <= 0) return false;

  const { error: insertErr } = await supabaseAdmin.from("order_attributions").insert({
    order_id: orderId,
    client_id: order.client_id,
    campaign_id: campaignId,
    value_cents: valueCents,
    source: signals.source,
  });

  if (insertErr) {
    if (insertErr.code === "23505") return false;
    throw new Error(insertErr.message);
  }

  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("attributed_revenue_cents, spend_cents")
    .eq("id", campaignId)
    .single();

  const newAttributed = ((campaign?.attributed_revenue_cents as number) ?? 0) + valueCents;

  await supabaseAdmin
    .from("campaigns")
    .update({
      attributed_revenue_cents: newAttributed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (!order.attributed_campaign_id) {
    await supabaseAdmin
      .from("orders")
      .update({
        attributed_campaign_id: campaignId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  }

  await recalculateClientMetrics(order.client_id as string);

  const { enrollAfterCampaignAttribution } = await import(
    "@/modules/retention/traffic-retention.server"
  );
  await enrollAfterCampaignAttribution(orderId).catch((err) =>
    console.error("[retention] traffic attribution enroll:", err),
  );

  return true;
}

export async function attributeTrafficConversionsBatch(): Promise<{ attributed: number }> {
  const since = new Date();
  since.setDate(since.getDate() - ATTRIBUTION_WINDOW_DAYS);

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("status", "entregue")
    .gte("updated_at", since.toISOString())
    .order("updated_at", { ascending: false })
    .limit(500);

  let attributed = 0;
  for (const o of orders ?? []) {
    const ok = await attributeDeliveredOrder(o.id as string).catch(() => false);
    if (ok) attributed += 1;
  }

  return { attributed };
}
