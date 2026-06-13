-- 051_product_fiscal_fields.sql — NCM/CFOP/CST por produto + UF emitente

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cfop text,
  ADD COLUMN IF NOT EXISTS cst  text;

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS state_uf text NOT NULL DEFAULT 'SP';

COMMENT ON COLUMN public.products.cfop IS 'CFOP override por SKU; fallback em fiscal_configs.default_cfop';
COMMENT ON COLUMN public.products.cst IS 'CST/CSOSN ICMS override por SKU';
COMMENT ON COLUMN public.fiscal_configs.state_uf IS 'UF do emitente para local_destino e CFOP inter/intra';
