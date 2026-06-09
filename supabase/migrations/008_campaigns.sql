-- ============================================================
-- 008_campaigns.sql
-- ad_accounts, campaigns — Módulo Tráfego
-- ============================================================

CREATE TABLE public.ad_accounts (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider     text        NOT NULL CHECK (provider IN ('meta','google')),
  external_id  text        NOT NULL,
  name         text,
  currency     text        NOT NULL DEFAULT 'BRL',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, provider, external_id)
);

CREATE TABLE public.campaigns (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_account_id   uuid        REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  external_id     text        NOT NULL,
  name            text        NOT NULL,
  platform        text        NOT NULL CHECK (platform IN ('meta','google')),
  status          text        NOT NULL DEFAULT 'ativa'
                              CHECK (status IN ('ativa','atencao','pausada')),
  spend_cents     bigint      NOT NULL DEFAULT 0,
  revenue_cents   bigint      NOT NULL DEFAULT 0,
  roas            numeric(5,2) NOT NULL DEFAULT 0,
  period_start    date,
  period_end      date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, external_id)
);

CREATE INDEX idx_campaigns_client_id ON public.campaigns(client_id);
CREATE INDEX idx_campaigns_platform  ON public.campaigns(platform);
CREATE INDEX idx_campaigns_status    ON public.campaigns(status);

CREATE TRIGGER set_updated_at_ad_accounts
  BEFORE UPDATE ON public.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_campaigns
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_accounts: member or staff"
  ON public.ad_accounts FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "ad_accounts: system write"
  ON public.ad_accounts FOR ALL USING (true);

CREATE POLICY "campaigns: member or staff"
  ON public.campaigns FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "campaigns: system write"
  ON public.campaigns FOR ALL USING (true);
