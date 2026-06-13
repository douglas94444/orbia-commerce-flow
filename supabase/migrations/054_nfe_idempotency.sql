-- 054_nfe_idempotency.sql — idempotência NF-e + histórico de eventos fiscais

ALTER TABLE public.nfe_emissions
  ADD COLUMN IF NOT EXISTS xml_storage_path text;

CREATE UNIQUE INDEX IF NOT EXISTS nfe_emissions_external_ref_unique
  ON public.nfe_emissions (external_ref)
  WHERE external_ref IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nfe_emissions_order_type_active_unique
  ON public.nfe_emissions (order_id, type)
  WHERE order_id IS NOT NULL AND status IN ('pendente', 'autorizada');

CREATE TABLE IF NOT EXISTS public.nfe_fiscal_events (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nfe_emission_id uuid        REFERENCES public.nfe_emissions(id) ON DELETE SET NULL,
  event_type      text        NOT NULL CHECK (event_type IN ('cancelamento', 'carta_correcao', 'inutilizacao')),
  description     text,
  payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_nfe_fiscal_events
  BEFORE UPDATE ON public.nfe_fiscal_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.nfe_fiscal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_fiscal_events: member or staff"
  ON public.nfe_fiscal_events FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "nfe_fiscal_events: system write"
  ON public.nfe_fiscal_events FOR ALL USING (true);
