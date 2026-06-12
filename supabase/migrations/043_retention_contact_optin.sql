-- LTV Boost: contato utilizável + opt-in marketing

ALTER TABLE public.customer_contact_prefs
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;

ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_provider text NOT NULL DEFAULT 'meta'
    CHECK (whatsapp_provider IN ('meta', 'evolution'));

COMMENT ON COLUMN public.customer_contact_prefs.contact_email IS 'Email para disparos (server-only, RLS)';
COMMENT ON COLUMN public.customer_contact_prefs.contact_phone IS 'Telefone E.164 para disparos (server-only)';
COMMENT ON COLUMN public.customer_contact_prefs.marketing_opt_in IS 'Consentimento LGPD para automações de marketing';

CREATE TABLE IF NOT EXISTS public.automation_coupons (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  code          text        NOT NULL,
  discount_pct  smallint    NOT NULL,
  expires_at    timestamptz NOT NULL,
  source        text,
  redeemed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_coupons_client ON public.automation_coupons(client_id);
ALTER TABLE public.automation_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_coupons: system write"
  ON public.automation_coupons FOR ALL TO service_role USING (true) WITH CHECK (true);
