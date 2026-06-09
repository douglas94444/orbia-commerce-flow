// Server-only webhook processor — no auth middleware.
// Import from server routes and *.server.ts files only.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logJob } from "@/shared/lib/logger";
import { ingestStoreWebhook } from "@/modules/logistics/order-ingestion.server";

export interface WebhookEventRow {
  id: string;
  provider: string;
  event_type: string;
  payload: unknown;
  client_id: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
}

export interface SaveWebhookInput {
  provider: string;
  eventId: string;
  eventType: string;
  clientId?: string;
  payload: unknown;
}

export async function saveWebhookEvent(
  input: SaveWebhookInput,
): Promise<{ queued: boolean; id: string }> {
  const { data, error } = await supabaseAdmin
    .from("webhook_events")
    .insert({
      provider: input.provider,
      event_id: input.eventId,
      event_type: input.eventType,
      client_id: input.clientId ?? null,
      payload: input.payload as Record<string, unknown>,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabaseAdmin
        .from("webhook_events")
        .select("id")
        .eq("provider", input.provider)
        .eq("event_id", input.eventId)
        .single();
      if (!existing) throw new Error("Webhook idempotency conflict without row");
      return { queued: false, id: existing.id };
    }
    throw new Error(`Failed to save webhook event: ${error.message}`);
  }

  return { queued: true, id: data.id };
}

export async function processWebhookEventInternal(
  eventId: string,
): Promise<{ processed?: boolean; skipped?: boolean; reason?: string }> {
  const start = Date.now();

  const { data: event, error: fetchError } = await supabaseAdmin
    .from("webhook_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (fetchError || !event) throw new Error(`Event ${eventId} not found`);

  if (event.status === "processed") return { skipped: true, reason: "already_processed" };
  if (event.status === "dead") return { skipped: true, reason: "dead_event" };

  await supabaseAdmin
    .from("webhook_events")
    .update({
      status: "processing",
      attempts: event.attempts + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  try {
    await routeWebhookEvent(event as WebhookEventRow);

    await supabaseAdmin
      .from("webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    await logJob({
      job_type: "webhook",
      job_id: eventId,
      client_id: event.client_id,
      status: "completed",
      duration_ms: Date.now() - start,
      metadata: { provider: event.provider, event_type: event.event_type },
    });

    return { processed: true };
  } catch (err) {
    const attempts = event.attempts + 1;
    const dead = attempts >= event.max_attempts;
    const nextRetry = dead ? null : new Date(Date.now() + attempts * 5 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("webhook_events")
      .update({
        status: dead ? "dead" : "failed",
        last_error: (err as Error).message,
        next_retry_at: nextRetry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    await logJob({
      job_type: "webhook",
      job_id: eventId,
      client_id: event.client_id,
      status: "failed",
      duration_ms: Date.now() - start,
      error: (err as Error).message,
      metadata: { provider: event.provider, attempts },
    });

    throw err;
  }
}

async function routeWebhookEvent(event: WebhookEventRow) {
  const { provider, event_type, payload, client_id } = event;

  switch (provider) {
    case "mercado_livre":
      console.warn(`[webhook] mercado_livre handler not implemented: ${event_type}`);
      break;
    case "shopee":
      console.warn(`[webhook] shopee handler not implemented: ${event_type}`);
      break;
    case "nuvemshop":
    case "shopify":
      await ingestStoreWebhook(provider, event_type, payload, client_id);
      break;
    default:
      console.warn(`[webhook] Unhandled provider: ${provider}`);
  }
}
