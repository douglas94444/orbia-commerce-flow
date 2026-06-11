-- ============================================================
-- 026_loyalty_whatsapp.sql
-- LTV Boost Fase 3: fidelidade, templates Meta, opt-out
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id       uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
  client_id         uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  points_balance    integer     NOT NULL DEFAULT 0,
  tier              text        NOT NULL DEFAULT 'bronze'
                                CHECK (tier IN ('bronze','prata','ouro','platina')),
  tier_progress_pct smallint    NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    uuid        NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  type          text        NOT NULL CHECK (type IN ('earn','redeem','expire','adjust')),
  points        integer     NOT NULL,
  order_id      uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at    timestamptz,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_coupons (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    uuid        NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  code          text        NOT NULL,
  discount_pct  smallint    NOT NULL,
  expires_at    timestamptz NOT NULL,
  redeemed_at   timestamptz,
  sent_via      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  language      text        NOT NULL DEFAULT 'pt_BR',
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected')),
  category      text        NOT NULL DEFAULT 'UTILITY',
  components    jsonb       NOT NULL DEFAULT '[]',
  external_id   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, name, language)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_opt_outs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phone_hash    text        NOT NULL,
  opted_out_at  timestamptz NOT NULL DEFAULT now(),
  source        text        NOT NULL DEFAULT 'keyword_parar',
  UNIQUE(client_id, phone_hash)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_client ON public.loyalty_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_account ON public.loyalty_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_client ON public.whatsapp_templates(client_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_opt_outs ON public.whatsapp_opt_outs(client_id, phone_hash);

CREATE TRIGGER set_updated_at_loyalty_accounts
  BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_whatsapp_templates
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_coupons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_opt_outs     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_accounts: member or staff"
  ON public.loyalty_accounts FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "loyalty_accounts: system write"
  ON public.loyalty_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "loyalty_tx: system write"
  ON public.loyalty_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "loyalty_coupons: system write"
  ON public.loyalty_coupons FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "wa_templates: member or staff"
  ON public.whatsapp_templates FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "wa_templates: member update"
  ON public.whatsapp_templates FOR UPDATE
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "wa_templates: system write"
  ON public.whatsapp_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "wa_opt_outs: system write"
  ON public.whatsapp_opt_outs FOR ALL TO service_role USING (true) WITH CHECK (true);
