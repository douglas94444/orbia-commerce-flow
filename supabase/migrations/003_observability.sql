-- ============================================================
-- 003_observability.sql
-- audit_logs, integration_logs, job_logs.
-- Created in migration 003 so all business tables can reference them.
-- audit_logs and integration_logs are IMMUTABLE — no UPDATE or DELETE ever.
-- ============================================================

-- ─── audit_logs ──────────────────────────────────────────────
-- Records every user-driven state mutation. Immutable audit trail.
CREATE TABLE public.audit_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id   uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  action      text        NOT NULL,  -- 'create' | 'update' | 'delete' | 'login' | 'oauth_connect'
  resource    text        NOT NULL,  -- table or entity name: 'client' | 'order' | 'campaign'
  resource_id text,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- No updated_at: rows are immutable
);

CREATE INDEX idx_audit_logs_client_id  ON public.audit_logs(client_id);
CREATE INDEX idx_audit_logs_user_id    ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action     ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Clients see their own audit trail; staff sees everything.
CREATE POLICY "audit_logs: member or staff"
  ON public.audit_logs FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

-- Only service role inserts (never anon/frontend directly).
-- WITH CHECK (true) allows service role inserts while anon cannot.
CREATE POLICY "audit_logs: system insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- No UPDATE. No DELETE. Ever.

-- ─── integration_logs ────────────────────────────────────────
-- Records every call to an external API. Immutable.
CREATE TABLE public.integration_logs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  provider       text        NOT NULL,  -- 'meta' | 'google' | 'mercado_livre' | 'sefaz' | 'claude'
  operation      text        NOT NULL,  -- 'sync_campaigns' | 'emit_nfe' | 'chat_completion'
  status         text        NOT NULL   CHECK (status IN ('success', 'error', 'timeout', 'retrying')),
  request_hash   text,                  -- SHA-256 of sanitized payload (no PII)
  response_code  smallint,
  duration_ms    integer,
  error_message  text,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
  -- No updated_at: immutable
);

CREATE INDEX idx_integration_logs_client_id  ON public.integration_logs(client_id);
CREATE INDEX idx_integration_logs_provider   ON public.integration_logs(provider);
CREATE INDEX idx_integration_logs_status     ON public.integration_logs(status);
CREATE INDEX idx_integration_logs_created_at ON public.integration_logs(created_at DESC);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_logs: member or staff"
  ON public.integration_logs FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "integration_logs: system insert"
  ON public.integration_logs FOR INSERT
  WITH CHECK (true);

-- No UPDATE. No DELETE. Ever.

-- ─── job_logs ────────────────────────────────────────────────
-- Tracks async job execution: webhooks, crons, sync operations.
-- Unlike audit/integration logs, job_logs CAN be updated (status transitions).
CREATE TABLE public.job_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type    text        NOT NULL,  -- 'webhook' | 'nfe_retry' | 'stock_sync' | 'report'
  job_id      text,                  -- external reference (Inngest ID, BullMQ job ID)
  client_id   uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  status      text        NOT NULL   CHECK (status IN ('started', 'completed', 'failed', 'retrying')),
  attempts    smallint    NOT NULL DEFAULT 0,
  duration_ms integer,
  error       text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_logs_client_id  ON public.job_logs(client_id);
CREATE INDEX idx_job_logs_status     ON public.job_logs(status);
CREATE INDEX idx_job_logs_job_type   ON public.job_logs(job_type);
CREATE INDEX idx_job_logs_created_at ON public.job_logs(created_at DESC);

ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_logs: member or staff"
  ON public.job_logs FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "job_logs: system insert"
  ON public.job_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "job_logs: system update"
  ON public.job_logs FOR UPDATE
  USING (true);

CREATE TRIGGER set_updated_at_job_logs
  BEFORE UPDATE ON public.job_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
