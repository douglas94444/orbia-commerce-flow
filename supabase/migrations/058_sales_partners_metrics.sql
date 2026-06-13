-- ============================================================
-- 058_sales_partners_metrics.sql — Parceiros, upsell, métricas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_partner_commissions (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id        uuid        NOT NULL REFERENCES public.sales_partners(id) ON DELETE CASCADE,
  prospect_id       uuid        REFERENCES public.sales_prospects(id),
  client_id         uuid        REFERENCES public.clients(id),
  plan              text        NOT NULL CHECK (plan IN ('launch','growth','scale')),
  commission_pct    numeric(5,2) NOT NULL DEFAULT 10.00,
  mrr_cents         integer     NOT NULL DEFAULT 0,
  commission_cents  integer     NOT NULL DEFAULT 0,
  period_month      date        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at           timestamptz,
  pix_receipt_ref   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_commercial_onboarding (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prospect_id     uuid        REFERENCES public.sales_prospects(id),
  week            smallint    NOT NULL CHECK (week BETWEEN 1 AND 4),
  task_key        text        NOT NULL,
  title           text        NOT NULL,
  responsible     text        NOT NULL CHECK (responsible IN ('orbia','merchant')),
  depends_on_key  text,
  is_done         boolean     NOT NULL DEFAULT false,
  blocker_note    text,
  due_at          timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, week, task_key)
);

CREATE TABLE IF NOT EXISTS public.sales_upsell_opportunities (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trigger_type    text        NOT NULL CHECK (trigger_type IN (
    'gmv_growth','fulfillment_limit','health_low','marketplace_expansion','chargeback_spike','support_volume'
  )),
  from_plan       text        CHECK (from_plan IN ('launch','growth','scale')),
  to_plan         text        CHECK (to_plan IN ('launch','growth','scale')),
  module_key      text,
  status          text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','proposed','won','lost','dismissed')),
  roi_params      jsonb       NOT NULL DEFAULT '{}',
  proposed_at     timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_partner_commissions_partner ON public.sales_partner_commissions(partner_id, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_sales_commercial_onboarding_client ON public.sales_commercial_onboarding(client_id, week);
CREATE INDEX IF NOT EXISTS idx_sales_upsell_client ON public.sales_upsell_opportunities(client_id, status);

CREATE TRIGGER sales_partner_commissions_updated_at
  BEFORE UPDATE ON public.sales_partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_commercial_onboarding_updated_at
  BEFORE UPDATE ON public.sales_commercial_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_upsell_opportunities_updated_at
  BEFORE UPDATE ON public.sales_upsell_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales_partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_commercial_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_upsell_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_partner_commissions: staff all"
  ON public.sales_partner_commissions FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_commercial_onboarding: staff all"
  ON public.sales_commercial_onboarding FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_upsell_opportunities: staff all"
  ON public.sales_upsell_opportunities FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

-- Fix cs_activities support_ticket kind
ALTER TABLE public.cs_activities DROP CONSTRAINT IF EXISTS cs_activities_kind_check;
ALTER TABLE public.cs_activities ADD CONSTRAINT cs_activities_kind_check
  CHECK (kind IN ('contact','qbr','nps','onboarding_note','support_ticket'));

-- Funnel metrics view
CREATE OR REPLACE VIEW public.sales_funnel_metrics AS
SELECT
  s.stage_key,
  s.label,
  s.position,
  COUNT(p.id) AS prospect_count,
  COUNT(p.id) FILTER (WHERE p.temperature = 'hot') AS hot_count,
  COUNT(p.id) FILTER (WHERE p.temperature = 'warm') AS warm_count,
  COUNT(p.id) FILTER (WHERE p.converted_client_id IS NOT NULL) AS converted_count
FROM public.sales_pipeline_stages s
LEFT JOIN public.sales_prospects p ON p.stage_id = s.id
GROUP BY s.id, s.stage_key, s.label, s.position
ORDER BY s.position;
