-- ============================================================
-- 055_sales_crm.sql — Motor de Vendas: CRM e pipeline
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_pipeline_stages (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_key   text        NOT NULL UNIQUE,
  label       text        NOT NULL,
  position    smallint    NOT NULL,
  color       text        NOT NULL DEFAULT 'oklch(0.66 0.2 292)',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sales_pipeline_stages (stage_key, label, position, color) VALUES
  ('captured',           'Lead capturado',       1, 'oklch(0.7 0.1 240)'),
  ('qualified',          'Qualificado',          2, 'oklch(0.75 0.12 200)'),
  ('diagnosis_sent',     'Diagnóstico enviado',   3, 'oklch(0.82 0.14 195)'),
  ('proposal_sent',      'Proposta enviada',     4, 'oklch(0.78 0.15 160)'),
  ('negotiation',        'Negociação',           5, 'oklch(0.72 0.18 80)'),
  ('contract_signed',    'Contrato assinado',    6, 'oklch(0.7 0.2 145)'),
  ('onboarding_started', 'Onboarding iniciado',  7, 'oklch(0.66 0.2 292)'),
  ('active_client',      'Cliente ativo',        8, 'oklch(0.65 0.18 150)')
ON CONFLICT (stage_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sales_prospects (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name            text        NOT NULL,
  contact_name            text        NOT NULL,
  email                   text        NOT NULL,
  phone                   text,
  whatsapp                text,
  platform                text,
  monthly_revenue_cents   bigint      NOT NULL DEFAULT 0,
  ad_spend_cents          bigint      NOT NULL DEFAULT 0,
  main_pain               text,
  segment                 text        NOT NULL DEFAULT 'Geral',
  is_decision_maker       boolean     NOT NULL DEFAULT false,
  urgency                 text        CHECK (urgency IS NULL OR urgency IN ('now','30d','90d','exploring')),
  qualification_score     smallint    NOT NULL DEFAULT 0 CHECK (qualification_score BETWEEN 0 AND 100),
  bant_budget             smallint    NOT NULL DEFAULT 0 CHECK (bant_budget BETWEEN 0 AND 25),
  bant_authority          smallint    NOT NULL DEFAULT 0 CHECK (bant_authority BETWEEN 0 AND 25),
  bant_need               smallint    NOT NULL DEFAULT 0 CHECK (bant_need BETWEEN 0 AND 25),
  bant_timeline           smallint    NOT NULL DEFAULT 0 CHECK (bant_timeline BETWEEN 0 AND 25),
  temperature             text        NOT NULL DEFAULT 'cold' CHECK (temperature IN ('cold','warm','hot')),
  stage_id                uuid        NOT NULL REFERENCES public.sales_pipeline_stages(id),
  assigned_staff_id       uuid        REFERENCES public.profiles(id),
  source                  text        NOT NULL DEFAULT 'inbound'
    CHECK (source IN ('inbound','partner','paid_ads','app_store','content','referral','chatbot')),
  partner_id              uuid,
  referral_code           text,
  utm_source              text,
  utm_medium              text,
  utm_campaign            text,
  communications_opt_out  boolean     NOT NULL DEFAULT false,
  converted_client_id     uuid        REFERENCES public.clients(id),
  converted_at            timestamptz,
  last_interaction_at     timestamptz,
  metadata                jsonb       NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_interactions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id uuid        NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  staff_id    uuid        REFERENCES public.profiles(id),
  kind        text        NOT NULL CHECK (kind IN (
    'email','call','meeting','note','proposal_sent','objection','stage_change','page_view'
  )),
  channel     text,
  notes       text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_tasks (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id         uuid        NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  assigned_staff_id   uuid        REFERENCES public.profiles(id),
  title               text        NOT NULL,
  due_at              timestamptz NOT NULL,
  completed_at        timestamptz,
  priority            text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_prospect_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id uuid        NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  event_type  text        NOT NULL CHECK (event_type IN (
    'email_opened','diagnosis_clicked','pricing_visited','proposal_opened','proposal_section_viewed','contract_viewed'
  )),
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_prospects_stage ON public.sales_prospects(stage_id);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_staff ON public.sales_prospects(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_source ON public.sales_prospects(source);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_temperature ON public.sales_prospects(temperature);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_created ON public.sales_prospects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_referral ON public.sales_prospects(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_interactions_prospect ON public.sales_interactions(prospect_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_prospect ON public.sales_tasks(prospect_id, due_at);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_due ON public.sales_tasks(due_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_prospect_events_prospect ON public.sales_prospect_events(prospect_id, created_at DESC);

CREATE TRIGGER sales_pipeline_stages_updated_at
  BEFORE UPDATE ON public.sales_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_prospects_updated_at
  BEFORE UPDATE ON public.sales_prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_tasks_updated_at
  BEFORE UPDATE ON public.sales_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_prospect_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_pipeline_stages: staff read"
  ON public.sales_pipeline_stages FOR SELECT
  USING (public.is_orbia_staff());

CREATE POLICY "sales_prospects: staff all"
  ON public.sales_prospects FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_interactions: staff all"
  ON public.sales_interactions FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_tasks: staff all"
  ON public.sales_tasks FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_prospect_events: staff read"
  ON public.sales_prospect_events FOR SELECT
  USING (public.is_orbia_staff());

CREATE POLICY "sales_prospect_events: staff insert"
  ON public.sales_prospect_events FOR INSERT
  WITH CHECK (public.is_orbia_staff());
