-- ============================================================
-- 032_fulfillment_cross.sql
-- Carrier configs per client, fulfillment billing, volume forecasts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_carrier_configs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider        text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  credentials_ref text,
  priority        integer     NOT NULL DEFAULT 0,
  auto_select     boolean     NOT NULL DEFAULT true,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, provider)
);

CREATE TABLE IF NOT EXISTS public.fulfillment_usage (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period_month    date        NOT NULL,
  orders_processed integer    NOT NULL DEFAULT 0,
  picks_completed integer     NOT NULL DEFAULT 0,
  packs_completed integer     NOT NULL DEFAULT 0,
  returns_handled integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, period_month)
);

CREATE TABLE IF NOT EXISTS public.volume_forecast_alerts (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  forecast_date   date        NOT NULL,
  expected_orders integer     NOT NULL,
  campaign_ref    text,
  notified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_client_carrier_configs
  BEFORE UPDATE ON public.client_carrier_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_fulfillment_usage
  BEFORE UPDATE ON public.fulfillment_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_carrier_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_usage     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volume_forecast_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_configs: member or staff"
  ON public.client_carrier_configs FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "carrier_configs: system write"
  ON public.client_carrier_configs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "fulfillment_usage: member or staff"
  ON public.fulfillment_usage FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "fulfillment_usage: system write"
  ON public.fulfillment_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "volume_forecast: system write"
  ON public.volume_forecast_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
