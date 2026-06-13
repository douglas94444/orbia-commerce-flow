-- 053_product_fiscal_ops.sql — CFOP por operação, CEST/ST, ICMS por UF, templates

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cfop_intra text,
  ADD COLUMN IF NOT EXISTS cfop_inter text,
  ADD COLUMN IF NOT EXISTS cfop_return_intra text,
  ADD COLUMN IF NOT EXISTS cfop_return_inter text,
  ADD COLUMN IF NOT EXISTS cest text,
  ADD COLUMN IF NOT EXISTS icms_st boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS icms_origem text NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS icms_rates jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.products
SET cfop_intra = cfop
WHERE cfop IS NOT NULL AND cfop_intra IS NULL;

CREATE TABLE IF NOT EXISTS public.fiscal_product_templates (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  segment       text        NOT NULL,
  name          text        NOT NULL,
  default_ncm   text,
  cfop_intra    text,
  cfop_inter    text,
  cfop_return_intra text,
  cfop_return_inter text,
  default_cst   text,
  cest          text,
  icms_st       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, segment)
);

CREATE TRIGGER set_updated_at_fiscal_product_templates
  BEFORE UPDATE ON public.fiscal_product_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fiscal_product_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_product_templates: member or staff"
  ON public.fiscal_product_templates FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "fiscal_product_templates: member write"
  ON public.fiscal_product_templates FOR INSERT
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "fiscal_product_templates: member update"
  ON public.fiscal_product_templates FOR UPDATE
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "fiscal_product_templates: member delete"
  ON public.fiscal_product_templates FOR DELETE
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

COMMENT ON COLUMN public.products.icms_rates IS 'Mapa UF destino → alíquota ICMS % ex: {"SP":18,"RJ":20}';
COMMENT ON COLUMN public.products.cfop_intra IS 'CFOP venda intraestadual; fallback cfop legado';
COMMENT ON COLUMN public.products.cfop_inter IS 'CFOP venda interestadual';
