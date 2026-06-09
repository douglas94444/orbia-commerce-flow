// Generic webhook processor for Orbia.
// Called after a webhook event is saved to the webhook_events table (status='queued').
// Pattern:
//   1. Provider POSTs → HTTP endpoint validates HMAC + saves to webhook_events
//   2. This handler processes the queued event
//   3. Routes to the correct module handler
//   4. Updates event status (processed / failed)
//
// This is a server-function-based processor for use in createServerFn or Inngest jobs.
// For real HTTP ingestion, wire up an HTTP endpoint that calls saveWebhookEvent() below.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { logJob } from '@/shared/lib/logger'

// ─── HMAC signature validators (per provider) ─────────────────

import { createHmac, timingSafeEqual } from 'node:crypto'

export function validateHmac(
  payload:   string,
  signature: string,
  secret:    string,
  algorithm: 'sha256' | 'sha1' = 'sha256',
): boolean {
  const expected = createHmac(algorithm, secret).update(payload).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// ─── saveWebhookEvent ─────────────────────────────────────────
// Call this from the HTTP ingestion layer (before processing).
// Guarantees idempotency via UNIQUE(provider, event_id).

interface SaveWebhookInput {
  provider:   string
  eventId:    string
  eventType:  string
  clientId?:  string
  payload:    unknown
}

export async function saveWebhookEvent(input: SaveWebhookInput): Promise<{ queued: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('webhook_events')
    .insert({
      provider:    input.provider,
      event_id:    input.eventId,
      event_type:  input.eventType,
      client_id:   input.clientId ?? null,
      payload:     input.payload,
      status:      'queued',
    })

  if (error) {
    // Unique constraint violation = already queued (idempotent)
    if (error.code === '23505') return { queued: false }
    throw new Error(`Failed to save webhook event: ${error.message}`)
  }

  return { queued: true }
}

// ─── processWebhookEvent ──────────────────────────────────────
// Processes a single queued webhook_event row.
// Called by background job runner (Inngest, BullMQ cron, etc.)

const processSchema = z.object({ eventId: z.string().uuid() })

export const processWebhookEvent = createServerFn({ method: 'POST' })
  .inputValidator(processSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const start = Date.now()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: event, error: fetchError } = await (supabaseAdmin as any)
      .from('webhook_events')
      .select('*')
      .eq('id', data.eventId)
      .single()

    if (fetchError || !event) throw new Error(`Event ${data.eventId} not found`)

    if (event.status === 'processed') return { skipped: true, reason: 'already_processed' }
    if (event.status === 'dead')      return { skipped: true, reason: 'dead_event' }

    // Mark as processing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('webhook_events')
      .update({ status: 'processing', attempts: event.attempts + 1, updated_at: new Date().toISOString() })
      .eq('id', data.eventId)

    try {
      await routeWebhookEvent(event)

      // Mark as processed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', data.eventId)

      await logJob({
        job_type:    'webhook',
        job_id:      data.eventId,
        client_id:   event.client_id,
        status:      'completed',
        duration_ms: Date.now() - start,
        metadata:    { provider: event.provider, event_type: event.event_type },
      })

      return { processed: true }

    } catch (err) {
      const attempts = event.attempts + 1
      const dead     = attempts >= event.max_attempts
      const nextRetry = dead ? null : new Date(Date.now() + attempts * 5 * 60 * 1000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('webhook_events')
        .update({
          status:        dead ? 'dead' : 'failed',
          last_error:    (err as Error).message,
          next_retry_at: nextRetry,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', data.eventId)

      await logJob({
        job_type:    'webhook',
        job_id:      data.eventId,
        client_id:   event.client_id,
        status:      'failed',
        duration_ms: Date.now() - start,
        error:       (err as Error).message,
        metadata:    { provider: event.provider, attempts },
      })

      throw err
    }
  })

// ─── Event router ─────────────────────────────────────────────
// Add handlers per provider + event_type as integrations are implemented.

async function routeWebhookEvent(event: { provider: string; event_type: string; payload: unknown; client_id: string | null }) {
  const { provider, event_type, payload, client_id } = event

  switch (provider) {
    case 'mercado_livre':
      await handleMercadoLivreEvent(event_type, payload, client_id)
      break
    case 'shopee':
      await handleShopeeEvent(event_type, payload, client_id)
      break
    case 'nuvemshop':
    case 'shopify':
      await handleStoreEvent(provider, event_type, payload, client_id)
      break
    default:
      // Unknown provider — log but don't fail (forward compatibility)
      console.warn(`[webhook] Unhandled provider: ${provider}`)
  }
}

// Stub handlers — implement when integrations are connected
async function handleMercadoLivreEvent(_type: string, _payload: unknown, _clientId: string | null) {
  // TODO: parse payload, upsert order into orders table, trigger NF-e emission
}

async function handleShopeeEvent(_type: string, _payload: unknown, _clientId: string | null) {
  // TODO: parse Shopee order payload, upsert order, validate SLA
}

async function handleStoreEvent(_provider: string, _type: string, _payload: unknown, _clientId: string | null) {
  // TODO: normalize Nuvemshop/Shopify order payload into unified order model
}
