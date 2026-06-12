-- LTV Boost R8-R10: checkout cupons, portal consumer, platform sync

ALTER TABLE public.automation_coupons
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS external_discount_id text;

CREATE INDEX IF NOT EXISTS idx_automation_coupons_code
  ON public.automation_coupons(client_id, code);

CREATE TABLE IF NOT EXISTS public.consumer_portal_tokens (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id   uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  used_at       timestamptz,
  UNIQUE (client_id, token_hash)
);

CREATE INDEX IF NOT EXISTS idx_consumer_portal_tokens_customer
  ON public.consumer_portal_tokens(customer_id, expires_at DESC);

ALTER TABLE public.consumer_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consumer_portal_tokens: service"
  ON public.consumer_portal_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
