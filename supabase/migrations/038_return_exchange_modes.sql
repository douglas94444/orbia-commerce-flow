-- Devoluções: políticas por loja, trocas e crédito em loja

CREATE TABLE IF NOT EXISTS public.return_policies (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             uuid        NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  approval_mode         text        NOT NULL DEFAULT 'manual'
                                      CHECK (approval_mode IN ('auto', 'manual')),
  default_resolution    text        NOT NULL DEFAULT 'refund'
                                      CHECK (default_resolution IN ('refund', 'exchange', 'store_credit')),
  allow_exchange        boolean     NOT NULL DEFAULT true,
  allow_store_credit    boolean     NOT NULL DEFAULT true,
  auto_approve_exchange boolean     NOT NULL DEFAULT false,
  whatsapp_phone        text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_return_policies
  BEFORE UPDATE ON public.return_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'return'
    CHECK (request_type IN ('return', 'exchange')),
  ADD COLUMN IF NOT EXISTS exchange_sku text,
  ADD COLUMN IF NOT EXISTS exchange_qty integer CHECK (exchange_qty IS NULL OR exchange_qty > 0),
  ADD COLUMN IF NOT EXISTS resolution text
    CHECK (resolution IS NULL OR resolution IN ('refund', 'exchange', 'store_credit')),
  ADD COLUMN IF NOT EXISTS exchange_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.store_credits (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id       uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  balance_cents     bigint      NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  source_return_id  uuid        REFERENCES public.return_requests(id) ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_credits_client ON public.store_credits(client_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_exchange_order ON public.return_requests(exchange_order_id);

ALTER TABLE public.return_policies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_credits    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_policies: member read"
  ON public.return_policies FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "return_policies: member write"
  ON public.return_policies FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "store_credits: member read"
  ON public.store_credits FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "store_credits: system write"
  ON public.store_credits FOR ALL TO service_role USING (true) WITH CHECK (true);
