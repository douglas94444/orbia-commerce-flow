-- ============================================================
-- 047_catalog_multichannel.sql
-- Channel pricing, stock buffers, listing prices
-- ============================================================

ALTER TABLE public.channel_listings
  ADD COLUMN IF NOT EXISTS channel_price_cents bigint;

CREATE TABLE IF NOT EXISTS public.channel_pricing_rules (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel         text        NOT NULL,
  rule_type       text        NOT NULL
                              CHECK (rule_type IN ('margin_pct', 'markup_pct', 'fixed_cents')),
  value           numeric     NOT NULL,
  min_price_cents bigint,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, channel, rule_type)
);

CREATE TABLE IF NOT EXISTS public.channel_stock_buffers (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel             text        NOT NULL,
  buffer_pct          numeric     NOT NULL DEFAULT 0,
  blackout_when_zero  boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_pricing_rules_client
  ON public.channel_pricing_rules(client_id, channel);

CREATE INDEX IF NOT EXISTS idx_channel_stock_buffers_client
  ON public.channel_stock_buffers(client_id, channel);

CREATE TRIGGER set_updated_at_channel_pricing_rules
  BEFORE UPDATE ON public.channel_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_channel_stock_buffers
  BEFORE UPDATE ON public.channel_stock_buffers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.channel_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_stock_buffers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_pricing_rules: member or staff"
  ON public.channel_pricing_rules FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "channel_pricing_rules: service write"
  ON public.channel_pricing_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "channel_stock_buffers: member or staff"
  ON public.channel_stock_buffers FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "channel_stock_buffers: service write"
  ON public.channel_stock_buffers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.channel_pricing_rules FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.channel_stock_buffers FROM anon, authenticated;
