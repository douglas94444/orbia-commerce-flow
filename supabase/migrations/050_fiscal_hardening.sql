-- 050_fiscal_hardening.sql — senha do certificado A1 (service_role only)

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS cert_password text;

COMMENT ON COLUMN public.fiscal_configs.cert_password IS
  'Senha do certificado A1 — nunca expor ao cliente; uso exclusivo server-side';
