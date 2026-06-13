-- ============================================================
-- 056_sales_diagnosis.sql — Diagnóstico e parceiros MVP
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_partners (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  email         text        NOT NULL,
  referral_code text        NOT NULL UNIQUE,
  tier          text        NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','diamond')),
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended')),
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_prospects
  ADD CONSTRAINT sales_prospects_partner_fk
  FOREIGN KEY (partner_id) REFERENCES public.sales_partners(id);

CREATE TABLE IF NOT EXISTS public.sales_diagnoses (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id           uuid        NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  type                  text        NOT NULL CHECK (type IN ('ecommerce','logistics','retention','meta_ads','full')),
  overall_score         smallint    NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  dimensions            jsonb       NOT NULL DEFAULT '[]',
  gaps                  jsonb       NOT NULL DEFAULT '[]',
  potential_growth_pct  numeric(5,2) NOT NULL DEFAULT 0,
  narrative             text,
  report_pdf_path       text,
  public_token          text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_paid               boolean     NOT NULL DEFAULT false,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_diagnosis_purchases (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnosis_id     uuid        NOT NULL REFERENCES public.sales_diagnoses(id) ON DELETE CASCADE,
  prospect_id      uuid        NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  idempotency_key  text        NOT NULL UNIQUE,
  amount_cents     integer     NOT NULL DEFAULT 3700,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  provider_ref     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_diagnoses_prospect ON public.sales_diagnoses(prospect_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_diagnoses_token ON public.sales_diagnoses(public_token);
CREATE INDEX IF NOT EXISTS idx_sales_partners_code ON public.sales_partners(referral_code);

CREATE TRIGGER sales_partners_updated_at
  BEFORE UPDATE ON public.sales_partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_diagnoses_updated_at
  BEFORE UPDATE ON public.sales_diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_diagnosis_purchases_updated_at
  BEFORE UPDATE ON public.sales_diagnosis_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_diagnosis_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_partners: staff all"
  ON public.sales_partners FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_diagnoses: staff all"
  ON public.sales_diagnoses FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_diagnosis_purchases: staff all"
  ON public.sales_diagnosis_purchases FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());
