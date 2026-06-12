-- ============================================================
-- 048_customer_identity.sql
-- Customer identity graph — cross-channel matching & merge
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS document_hash text,
  ADD COLUMN IF NOT EXISTS merged_into_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.customer_channel_links (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id         uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel             text        NOT NULL,
  external_buyer_id   text        NOT NULL,
  email_hash          text,
  phone_hash          text,
  document_hash       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, channel, external_buyer_id)
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_document_hash
  ON public.customers(client_id, document_hash)
  WHERE document_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_merged_into
  ON public.customers(merged_into_customer_id)
  WHERE merged_into_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_channel_links_customer
  ON public.customer_channel_links(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON public.orders(customer_id);

CREATE TRIGGER set_updated_at_customer_channel_links
  BEFORE UPDATE ON public.customer_channel_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customer_channel_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_channel_links: member or staff"
  ON public.customer_channel_links FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "customer_channel_links: service write"
  ON public.customer_channel_links FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.customer_channel_links FROM anon, authenticated;
