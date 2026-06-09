-- ============================================================
-- 004_webhooks.sql
-- Idempotent webhook event storage and processing tracking.
-- UNIQUE(provider, event_id) is the hard idempotency constraint.
-- Assume providers will send: duplicates, delays, out-of-order events.
-- ============================================================

CREATE TABLE public.webhook_events (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider        text        NOT NULL,  -- 'mercado_livre' | 'shopee' | 'amazon' | 'tiktok' | 'shopify' | 'nuvemshop'
  event_id        text        NOT NULL,  -- provider's unique event ID — used for idempotency
  event_type      text        NOT NULL,  -- 'order.created' | 'payment.approved' | 'stock.updated'
  client_id       uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  payload         jsonb       NOT NULL,
  status          text        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'processing', 'processed', 'failed', 'dead')),
  attempts        smallint    NOT NULL DEFAULT 0,
  max_attempts    smallint    NOT NULL DEFAULT 3,
  last_error      text,
  processed_at    timestamptz,
  next_retry_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Hard idempotency: same provider + event_id is never inserted twice
  UNIQUE(provider, event_id)
);

CREATE INDEX idx_webhook_events_status     ON public.webhook_events(status);
CREATE INDEX idx_webhook_events_provider   ON public.webhook_events(provider);
CREATE INDEX idx_webhook_events_client_id  ON public.webhook_events(client_id);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Partial index for the retry queue — only failed events eligible for retry
CREATE INDEX idx_webhook_events_retry
  ON public.webhook_events(next_retry_at)
  WHERE status = 'failed' AND attempts < max_attempts;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Written only by service role (server). Never from the browser.
CREATE POLICY "webhook_events: member or staff"
  ON public.webhook_events FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "webhook_events: system insert"
  ON public.webhook_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "webhook_events: system update"
  ON public.webhook_events FOR UPDATE
  USING (true);

CREATE TRIGGER set_updated_at_webhook_events
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
