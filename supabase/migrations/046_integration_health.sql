-- Marketplaces M0: saúde de integrações por canal

CREATE TABLE IF NOT EXISTS public.integration_health_snapshots (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider          text        NOT NULL,
  status            text        NOT NULL DEFAULT 'unknown'
                                CHECK (status IN ('healthy','degraded','down','unknown')),
  last_webhook_at   timestamptz,
  last_success_at   timestamptz,
  last_error        text,
  token_expires_at  timestamptz,
  failure_streak    smallint    NOT NULL DEFAULT 0,
  metadata          jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_health_client
  ON public.integration_health_snapshots(client_id, status);

ALTER TABLE public.integration_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_health: member or staff"
  ON public.integration_health_snapshots FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());
CREATE POLICY "integration_health: service write"
  ON public.integration_health_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
