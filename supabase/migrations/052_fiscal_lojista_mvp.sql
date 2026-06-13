-- 052_fiscal_lojista_mvp.sql — IE, dados NFS-e e sync Focus por lojista

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS state_registration text,
  ADD COLUMN IF NOT EXISTS municipal_registration text,
  ADD COLUMN IF NOT EXISTS municipality_code text,
  ADD COLUMN IF NOT EXISTS focus_synced_at timestamptz;

COMMENT ON COLUMN public.fiscal_configs.state_registration IS 'Inscrição estadual do emitente (ou ISENTO)';
COMMENT ON COLUMN public.fiscal_configs.municipal_registration IS 'Inscrição municipal para NFS-e';
COMMENT ON COLUMN public.fiscal_configs.municipality_code IS 'Código IBGE do município do emitente';
COMMENT ON COLUMN public.fiscal_configs.focus_synced_at IS 'Última sincronização bem-sucedida com Focus NFe /v2/empresas';
