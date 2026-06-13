-- 063_fiscal_webhooks_series.sql — séries, webhooks Focus, auto_emit

CREATE TABLE IF NOT EXISTS public.fiscal_series (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doc_type      text        NOT NULL CHECK (doc_type IN ('nfe','nfce','nfse')),
  serie         text        NOT NULL DEFAULT '1',
  last_number   integer     NOT NULL DEFAULT 0,
  environment   text        NOT NULL DEFAULT 'producao',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, doc_type, serie, environment)
);

CREATE TABLE IF NOT EXISTS public.fiscal_webhook_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider    text        NOT NULL DEFAULT 'focus_nfe',
  event_id    text        NOT NULL,
  event_type  text        NOT NULL,
  client_id   uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  payload     jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processed','failed')),
  attempts    smallint    NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(provider, event_id)
);

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS nfce_csc_id text,
  ADD COLUMN IF NOT EXISTS nfce_csc_token text,
  ADD COLUMN IF NOT EXISTS auto_emit_nfe boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_emit_nfce boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_emit_nfse boolean NOT NULL DEFAULT false;

ALTER TABLE public.nfe_emissions
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS number integer,
  ADD COLUMN IF NOT EXISTS webhook_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_fiscal_series_client ON public.fiscal_series(client_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_fiscal_webhook_status ON public.fiscal_webhook_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_nfe_emissions_series ON public.nfe_emissions(client_id, series, number);

CREATE TRIGGER fiscal_series_updated_at
  BEFORE UPDATE ON public.fiscal_series FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fiscal_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_series: member"
  ON public.fiscal_series FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "fiscal_webhook_events: staff read"
  ON public.fiscal_webhook_events FOR SELECT
  USING (public.is_orbia_staff() OR client_id = public.current_client_id());
