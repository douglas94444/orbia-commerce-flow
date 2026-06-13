-- 067_fiscal_environment.sql — preferência de ambiente Focus por lojista

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS focus_environment text NOT NULL DEFAULT 'homologacao'
    CHECK (focus_environment IN ('homologacao', 'producao'));
