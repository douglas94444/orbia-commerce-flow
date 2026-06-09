-- ============================================================
-- 018_product_catalog.sql
-- Centralized product catalog + channel listings (Fase 2B)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.products (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku           text        NOT NULL,
  name          text        NOT NULL,
  ncm           text,
  weight_grams  integer,
  price_cents   bigint,
  is_active     boolean     NOT NULL DEFAULT true,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, sku)
);

CREATE TABLE IF NOT EXISTS public.channel_listings (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id            uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  channel               text        NOT NULL,
  external_product_id   text        NOT NULL,
  external_variant_id   text,
  listing_status        text        NOT NULL DEFAULT 'active',
  last_synced_at        timestamptz,
  metadata              jsonb       NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, channel, external_product_id, external_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_products_client ON public.products(client_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(client_id, sku);
CREATE INDEX IF NOT EXISTS idx_listings_client ON public.channel_listings(client_id);
CREATE INDEX IF NOT EXISTS idx_listings_product ON public.channel_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_listings_lookup ON public.channel_listings(client_id, channel, external_variant_id);

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_channel_listings
  BEFORE UPDATE ON public.channel_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products: member or staff"
  ON public.products FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "products: staff write"
  ON public.products FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "channel_listings: member or staff"
  ON public.channel_listings FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "channel_listings: staff write"
  ON public.channel_listings FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());
