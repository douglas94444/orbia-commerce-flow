-- ============================================================
-- 022_ecaas_diferenciais.sql
-- Recebíveis, precificação, benchmarks, outbox de eventos durável
-- ============================================================

-- ─── Outbox (event bus durável) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.domain_event_outbox (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name   text        NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}',
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','processing','completed','failed')),
  attempts     smallint    NOT NULL DEFAULT 0,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON public.domain_event_outbox(status, created_at);

ALTER TABLE public.domain_event_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox: staff read"
  ON public.domain_event_outbox FOR SELECT
  USING (public.is_orbia_staff());

CREATE POLICY "outbox: service write"
  ON public.domain_event_outbox FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.domain_event_outbox FROM anon, authenticated;

-- ─── Recebíveis consolidados ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.receivables (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source          text        NOT NULL,  -- mercado_livre | shopee | mercado_pago | manual
  external_ref    text,
  description     text,
  gross_cents     bigint      NOT NULL,
  fee_cents       bigint      NOT NULL DEFAULT 0,
  net_cents       bigint      NOT NULL,
  expected_at     date,
  received_at     timestamptz,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','received','overdue','cancelled')),
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receivables_client ON public.receivables(client_id, status);

ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receivables: member or staff"
  ON public.receivables FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "receivables: service write"
  ON public.receivables FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.receivables FROM anon, authenticated;

-- ─── Precificação inteligente (recomendações) ────────────────

CREATE TABLE IF NOT EXISTS public.pricing_recommendations (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku             text        NOT NULL,
  current_cents   bigint      NOT NULL,
  suggested_cents bigint      NOT NULL,
  margin_pct      numeric(5,2),
  rationale       text,
  confidence      smallint    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','applied','dismissed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_client ON public.pricing_recommendations(client_id, status);

ALTER TABLE public.pricing_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing: member or staff"
  ON public.pricing_recommendations FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "pricing: staff write"
  ON public.pricing_recommendations FOR ALL
  USING (public.is_orbia_staff()) WITH CHECK (public.is_orbia_staff());

-- ─── Benchmarks de carteira ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.benchmark_snapshots (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        REFERENCES public.clients(id) ON DELETE CASCADE,
  metric_key      text        NOT NULL,  -- roas | margin | sla | nps
  value           numeric     NOT NULL,
  portfolio_avg   numeric,
  portfolio_p75   numeric,
  ai_summary      text,
  snapshot_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_client ON public.benchmark_snapshots(client_id, metric_key, snapshot_at DESC);

ALTER TABLE public.benchmark_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "benchmarks: member or staff"
  ON public.benchmark_snapshots FOR SELECT
  USING (client_id IS NULL OR client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "benchmarks: service write"
  ON public.benchmark_snapshots FOR INSERT TO service_role
  WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.benchmark_snapshots FROM anon, authenticated;
