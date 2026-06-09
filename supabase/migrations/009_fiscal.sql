-- ============================================================
-- 009_fiscal.sql
-- nfe_emissions, fiscal_configs — Módulo Fiscal
-- XMLs e DANFEs são stored no Supabase Storage.
-- nfe_emissions é append-only (cancelamentos são novas linhas).
-- ============================================================

CREATE TABLE public.nfe_emissions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id      uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  external_ref  text,                 -- Focus NFe / Nuvem Fiscal reference
  type          text        NOT NULL  CHECK (type IN ('NF-e','NFC-e','NFS-e')),
  status        text        NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('autorizada','pendente','rejeitada','cancelada')),
  access_key    text        UNIQUE,   -- 44-digit SEFAZ key
  value_cents   bigint      NOT NULL,
  retries       smallint    NOT NULL DEFAULT 0,
  last_error    text,
  xml_url       text,                 -- Supabase Storage path (keep 5 years)
  danfe_url     text,
  authorized_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fiscal_configs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid        UNIQUE NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cnpj         text        NOT NULL,
  company_name text        NOT NULL,
  tax_regime   text        NOT NULL CHECK (tax_regime IN ('simples','lucro_presumido','lucro_real')),
  default_cfop text,
  default_cst  text,
  default_ncm  text,
  cert_expires_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfe_client_id  ON public.nfe_emissions(client_id);
CREATE INDEX idx_nfe_status     ON public.nfe_emissions(status);
CREATE INDEX idx_nfe_order_id   ON public.nfe_emissions(order_id);
CREATE INDEX idx_nfe_created_at ON public.nfe_emissions(created_at DESC);

CREATE TRIGGER set_updated_at_nfe
  BEFORE UPDATE ON public.nfe_emissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_fiscal_configs
  BEFORE UPDATE ON public.fiscal_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.nfe_emissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_emissions: member or staff"
  ON public.nfe_emissions FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "nfe_emissions: system write"
  ON public.nfe_emissions FOR ALL USING (true);

CREATE POLICY "fiscal_configs: member or staff"
  ON public.fiscal_configs FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "fiscal_configs: system write"
  ON public.fiscal_configs FOR ALL USING (true);
