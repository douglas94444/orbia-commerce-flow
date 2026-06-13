-- ============================================================
-- 061_sac_returns_reviews.sql — Devoluções SAC + marketplace claims
-- ============================================================

ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS sac_ticket_id uuid REFERENCES public.sac_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_return_requests_sac_ticket ON public.return_requests(sac_ticket_id);

CREATE TABLE IF NOT EXISTS public.sac_marketplace_claims (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ticket_id             uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  platform              text        NOT NULL CHECK (platform IN ('mercado_livre','shopee','amazon')),
  external_claim_id     text        NOT NULL,
  deadline_at           timestamptz,
  amount_at_risk_cents  bigint      NOT NULL DEFAULT 0,
  status                text        NOT NULL DEFAULT 'open',
  evidence              jsonb       NOT NULL DEFAULT '{}',
  outcome               text        CHECK (outcome IS NULL OR outcome IN ('won','lost','pending')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, external_claim_id)
);

-- Link cs_reviews to sac_tickets (nullable FK)
ALTER TABLE public.cs_reviews
  ADD COLUMN IF NOT EXISTS sac_ticket_id uuid REFERENCES public.sac_tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cs_reviews_sac_ticket ON public.cs_reviews(sac_ticket_id);

CREATE OR REPLACE VIEW public.sac_review_summary AS
SELECT
  r.client_id,
  r.rating,
  COUNT(*) AS review_count,
  COUNT(*) FILTER (WHERE r.rating <= 2) AS negative_count,
  AVG(r.rating)::numeric(4,2) AS avg_rating
FROM public.cs_reviews r
GROUP BY r.client_id, r.rating;

CREATE TRIGGER sac_marketplace_claims_updated_at
  BEFORE UPDATE ON public.sac_marketplace_claims FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sac_marketplace_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sac_marketplace_claims: member"
  ON public.sac_marketplace_claims FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());
