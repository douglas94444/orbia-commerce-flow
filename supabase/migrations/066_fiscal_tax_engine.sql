-- 066_fiscal_tax_engine.sql — regras tributárias + métricas

CREATE TABLE IF NOT EXISTS public.fiscal_tax_rules (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  uf_destino      text        NOT NULL,
  ncm_prefix      text        NOT NULL DEFAULT '',
  icms_aliquota   numeric(5,2),
  fcp_aliquota    numeric(5,2) NOT NULL DEFAULT 0,
  difal_enabled   boolean     NOT NULL DEFAULT false,
  ipi_cst         text,
  mva_st          numeric(8,4),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, uf_destino, ncm_prefix)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_tax_rules_lookup
  ON public.fiscal_tax_rules(client_id, uf_destino, ncm_prefix);

CREATE TRIGGER fiscal_tax_rules_updated_at
  BEFORE UPDATE ON public.fiscal_tax_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fiscal_tax_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_tax_rules: member"
  ON public.fiscal_tax_rules FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE OR REPLACE VIEW public.fiscal_emission_metrics_daily AS
SELECT
  e.client_id,
  DATE(e.created_at) AS day,
  e.type,
  o.channel,
  COUNT(*) AS emission_count,
  COUNT(*) FILTER (WHERE e.status = 'autorizada') AS authorized_count,
  COUNT(*) FILTER (WHERE e.status = 'rejeitada') AS rejected_count,
  AVG(EXTRACT(EPOCH FROM (e.authorized_at - e.created_at)) / 60)
    FILTER (WHERE e.authorized_at IS NOT NULL) AS avg_auth_minutes
FROM public.nfe_emissions e
LEFT JOIN public.orders o ON o.id = e.order_id
GROUP BY e.client_id, DATE(e.created_at), e.type, o.channel;
