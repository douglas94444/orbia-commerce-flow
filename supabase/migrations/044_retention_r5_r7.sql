-- LTV Boost R5-R7: tráfego, opt-in configurável, promoções wishlist

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS marketing_implicit_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.marketing_implicit_opt_in IS
  'Se true, primeira compra grava marketing_opt_in automaticamente (LGPD: default false)';

ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean;

CREATE INDEX IF NOT EXISTS idx_enrollments_dedup
  ON public.automation_enrollments(sequence_id, customer_id, status)
  WHERE status IN ('active', 'paused');
