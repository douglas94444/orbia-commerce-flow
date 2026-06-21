// Structured logger for all critical operations.
// Writes to Supabase (audit_logs, integration_logs, job_logs) via service role.
// Never logs PII. Never logs raw tokens. Use request_hash for payloads.
//
// Server-only: import only inside createServerFn handlers or *.server.ts files.

import { createClient } from '@supabase/supabase-js'

// Use an untyped client for logging so that TypeScript doesn't fight over
// the immutable tables (Update: never). Type safety is at the call-site
// parameters of each log function — not inside the logger itself.
function getLoggerClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// ─── Types ────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'meta'
  | 'google'
  | 'mercado_livre'
  | 'shopee'
  | 'amazon'
  | 'tiktok'
  | 'instagram'
  | 'nuvemshop'
  | 'shopify'
  | 'focus_nfe'
  | 'nuvem_fiscal'
  | 'sefaz'
  | 'claude'
  | 'stripe'
  | 'pagar_me'
  | 'mercado_pago'
  | 'correios'
  | 'jadlog'
  | 'jt_express'
  | 'total_express'
  | 'melhor_envio'
  | 'resend'
  | 'evolution'
  | 'fcm'
  | 'twilio'
  | 'whatsapp'

export type IntegrationStatus = 'success' | 'error' | 'timeout' | 'retrying'
export type JobStatus = 'started' | 'completed' | 'failed' | 'retrying'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'oauth_connect'
  | 'oauth_revoke'
  | 'client_provision'
  | 'member_invite'
  | 'nfe_emit'
  | 'webhook_process'
  | 'nfe_emit'
  | 'nfe_emit_manual'
  | 'nfe_emit_async'
  | 'nfe_retry'
  | 'nfe_cancel'
  | 'nfe_cce'
  | 'nfe_inutilizacao'
  | 'nfce_emit'
  | 'nfse_emit'

// ─── Integration logger ───────────────────────────────────────
// Use for every call to an external API (Meta, SEFAZ, Claude, etc.)

export async function logIntegration(entry: {
  client_id?: string
  provider: IntegrationProvider
  operation: string
  status: IntegrationStatus
  response_code?: number
  duration_ms?: number
  error_message?: string
  request_hash?: string  // SHA-256 of sanitized, PII-free payload
  request_data?: Record<string, unknown>  // sanitized, PII-free request payload
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = getLoggerClient()
    const { request_data, metadata, ...rest } = entry
    await supabase.from('integration_logs').insert({
      ...rest,
      metadata: request_data ? { ...(metadata ?? {}), request_data } : metadata,
    })
  } catch (err) {
    // Logger must never throw — log to console as fallback
    console.error('[logger.integration] failed to write:', err)
  }
}

// ─── Audit logger ─────────────────────────────────────────────
// Use for every user-driven state mutation.

export async function logAudit(entry: {
  user_id?: string
  client_id?: string
  action: AuditAction
  resource: string
  resource_id?: string
  old_data?: unknown
  new_data?: unknown
  ip_address?: string
  user_agent?: string
}): Promise<void> {
  try {
    const supabase = getLoggerClient()
    await supabase.from('audit_logs').insert(entry)
  } catch (err) {
    console.error('[logger.audit] failed to write:', err)
  }
}

// ─── Job logger ───────────────────────────────────────────────
// Use for async job lifecycle (webhooks, crons, background sync).

export async function logJob(entry: {
  job_type: string
  job_id?: string
  client_id?: string
  status: JobStatus
  attempts?: number
  duration_ms?: number
  error?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = getLoggerClient()
    await supabase.from('job_logs').insert(entry)
  } catch (err) {
    console.error('[logger.job] failed to write:', err)
  }
}

// ─── Timing helper ────────────────────────────────────────────
// Use with logIntegration to measure external call duration.
//
// Example:
//   const end = startTimer()
//   await callMetaApi(...)
//   await logIntegration({ ..., duration_ms: end() })

export function startTimer(): () => number {
  const start = Date.now()
  return () => Date.now() - start
}
