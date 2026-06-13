-- ============================================================
-- 057_sales_proposals_contracts.sql — Propostas e contratos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sales_proposals (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id       uuid        NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  recommended_plan  text        NOT NULL CHECK (recommended_plan IN ('launch','growth','scale')),
  roi_params        jsonb       NOT NULL DEFAULT '{}',
  content           jsonb       NOT NULL DEFAULT '{}',
  public_token      text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  valid_until       timestamptz NOT NULL,
  version           integer     NOT NULL DEFAULT 1,
  status            text        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','accepted','expired','rejected')),
  sent_at           timestamptz,
  created_by        uuid        REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_proposal_views (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id  uuid        NOT NULL REFERENCES public.sales_proposals(id) ON DELETE CASCADE,
  section_key  text        NOT NULL,
  duration_ms  integer     NOT NULL DEFAULT 0,
  user_agent   text,
  viewed_at    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_contracts (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id     uuid        NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  proposal_id     uuid        REFERENCES public.sales_proposals(id),
  plan            text        NOT NULL CHECK (plan IN ('launch','growth','scale')),
  monthly_cents   integer     NOT NULL,
  clauses         jsonb       NOT NULL DEFAULT '{}',
  public_token    text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','cancelled','expired')),
  signed_at       timestamptz,
  signer_name     text,
  signer_email    text,
  signer_ip       text,
  provider_ref    text,
  valid_until     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_contract_amendments (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id     uuid        NOT NULL REFERENCES public.sales_contracts(id) ON DELETE CASCADE,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  from_plan       text        NOT NULL CHECK (from_plan IN ('launch','growth','scale')),
  to_plan         text        NOT NULL CHECK (to_plan IN ('launch','growth','scale')),
  monthly_cents   integer     NOT NULL,
  clauses         jsonb       NOT NULL DEFAULT '{}',
  signed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_proposals_prospect ON public.sales_proposals(prospect_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_sales_proposals_token ON public.sales_proposals(public_token);
CREATE INDEX IF NOT EXISTS idx_sales_proposal_views_proposal ON public.sales_proposal_views(proposal_id);
CREATE INDEX IF NOT EXISTS idx_sales_contracts_prospect ON public.sales_contracts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sales_contracts_token ON public.sales_contracts(public_token);

CREATE TRIGGER sales_proposals_updated_at
  BEFORE UPDATE ON public.sales_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_contracts_updated_at
  BEFORE UPDATE ON public.sales_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER sales_contract_amendments_updated_at
  BEFORE UPDATE ON public.sales_contract_amendments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_proposal_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_contract_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_proposals: staff all"
  ON public.sales_proposals FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_proposal_views: staff read"
  ON public.sales_proposal_views FOR SELECT
  USING (public.is_orbia_staff());

CREATE POLICY "sales_contracts: staff all"
  ON public.sales_contracts FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "sales_contract_amendments: staff all"
  ON public.sales_contract_amendments FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());
