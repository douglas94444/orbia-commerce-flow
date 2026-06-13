-- 064_fiscal_nfce.sql — configurações NFC-e

CREATE TABLE IF NOT EXISTS public.fiscal_nfce_settings (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  csc_id              text,
  csc_token           text,
  qr_code_version     smallint    NOT NULL DEFAULT 2,
  presenca_default    text        NOT NULL DEFAULT '1',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER fiscal_nfce_settings_updated_at
  BEFORE UPDATE ON public.fiscal_nfce_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fiscal_nfce_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_nfce_settings: member"
  ON public.fiscal_nfce_settings FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());
