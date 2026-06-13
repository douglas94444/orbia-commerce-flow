-- 065_fiscal_nfse.sql — catálogo de serviços ISS

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS iss_retido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS natureza_operacao_nfse text DEFAULT 'Prestação de serviço';

CREATE TABLE IF NOT EXISTS public.fiscal_service_catalog (
  id                          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id                   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  item_lista_servico          text        NOT NULL,
  codigo_tributacao_municipio text,
  aliquota_iss                numeric(5,2) NOT NULL DEFAULT 2.00,
  descricao                   text        NOT NULL,
  municipality_code           text,
  is_default                  boolean     NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_service_catalog_client ON public.fiscal_service_catalog(client_id);

CREATE TRIGGER fiscal_service_catalog_updated_at
  BEFORE UPDATE ON public.fiscal_service_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fiscal_service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_service_catalog: member"
  ON public.fiscal_service_catalog FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());
