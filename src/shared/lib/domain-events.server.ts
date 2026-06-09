// Domain event bus — handlers in-process + durable outbox for retry.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, EventHandler[]>();

export function onDomainEvent(event: string, handler: EventHandler): void {
  const list = handlers.get(event) ?? [];
  list.push(handler);
  handlers.set(event, list);
}

async function runHandlers(event: string, payload: Record<string, unknown>): Promise<void> {
  const list = handlers.get(event) ?? [];
  for (const handler of list) {
    await handler(payload);
  }
}

export async function emitDomainEvent(
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  let outboxId: string | null = null;

  try {
    const { data: row } = await supabaseAdmin
      .from("domain_event_outbox")
      .insert({ event_name: event, payload, status: "processing" })
      .select("id")
      .single();
    outboxId = row?.id ?? null;
  } catch {
    // outbox table may not exist yet — run handlers only
  }

  try {
    await runHandlers(event, payload);
    if (outboxId) {
      await supabaseAdmin
        .from("domain_event_outbox")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", outboxId);
    }
  } catch (err) {
    if (outboxId) {
      await supabaseAdmin
        .from("domain_event_outbox")
        .update({
          status: "failed",
          attempts: 1,
          last_error: (err as Error).message,
        })
        .eq("id", outboxId);
    }
    throw err;
  }
}

export async function processOutboxBatch(limit = 50): Promise<{ processed: number; failed: number }> {
  const { data: rows } = await supabaseAdmin
    .from("domain_event_outbox")
    .select("id, event_name, payload, attempts")
    .in("status", ["pending", "failed"])
    .lt("attempts", 5)
    .order("created_at")
    .limit(limit);

  let processed = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    await supabaseAdmin
      .from("domain_event_outbox")
      .update({ status: "processing" })
      .eq("id", row.id);

    try {
      await runHandlers(row.event_name, row.payload as Record<string, unknown>);
      await supabaseAdmin
        .from("domain_event_outbox")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", row.id);
      processed++;
    } catch (err) {
      failed++;
      await supabaseAdmin
        .from("domain_event_outbox")
        .update({
          status: "failed",
          attempts: (row.attempts ?? 0) + 1,
          last_error: (err as Error).message,
        })
        .eq("id", row.id);
    }
  }

  return { processed, failed };
}
