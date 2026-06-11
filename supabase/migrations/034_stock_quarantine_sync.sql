-- Quarantine RLS for client members + stock sync outbox

CREATE POLICY quarantine_items_insert_member
  ON public.quarantine_items FOR INSERT
  WITH CHECK (client_id = public.current_client_id());

CREATE POLICY quarantine_items_update_member
  ON public.quarantine_items FOR UPDATE
  USING (client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());

CREATE TABLE IF NOT EXISTS public.stock_sync_jobs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku             text        NOT NULL,
  idempotency_key text        NOT NULL UNIQUE,
  status          text        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued','completed','failed')),
  attempts        integer     NOT NULL DEFAULT 0,
  last_error      text,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_sync_jobs_queued
  ON public.stock_sync_jobs(status, created_at)
  WHERE status = 'queued';

ALTER TABLE public.stock_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY stock_sync_jobs_select_member
  ON public.stock_sync_jobs FOR SELECT
  USING (client_id = public.current_client_id());

CREATE POLICY stock_sync_jobs_all_service
  ON public.stock_sync_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
