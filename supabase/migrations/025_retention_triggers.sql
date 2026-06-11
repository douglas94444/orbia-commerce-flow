-- ============================================================
-- 025_retention_triggers.sql
-- LTV Boost Fase 2: carrinho abandonado, wishlist, boletos, device tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  external_id   text,
  email_hash    text,
  phone_hash    text,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  value_cents   bigint      NOT NULL DEFAULT 0,
  items         jsonb       NOT NULL DEFAULT '[]',
  checkout_url  text,
  abandoned_at  timestamptz NOT NULL DEFAULT now(),
  converted_at  timestamptz,
  status        text        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','converted','expired')),
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE CASCADE,
  product_sku   text        NOT NULL,
  product_name  text,
  product_image text,
  view_count    integer     NOT NULL DEFAULT 1,
  notified_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, customer_id, product_sku)
);

CREATE TABLE IF NOT EXISTS public.boleto_reminders (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id        uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  boleto_url      text        NOT NULL,
  due_at          timestamptz NOT NULL,
  paid_at         timestamptz,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','paid','expired','regenerated')),
  enrollment_id   uuid        REFERENCES public.automation_enrollments(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE CASCADE,
  token         text        NOT NULL,
  platform      text        NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios','android','web')),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, token)
);

CREATE TABLE IF NOT EXISTS public.cs_reviews (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id      uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id   uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  rating        smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  ticket_id     uuid,
  handled_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_open ON public.abandoned_carts(client_id, status, abandoned_at)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_wishlist_client ON public.wishlist_items(client_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_boleto_pending ON public.boleto_reminders(status, due_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cs_reviews_negative ON public.cs_reviews(client_id, rating)
  WHERE rating <= 2;

CREATE TRIGGER set_updated_at_wishlist_items
  BEFORE UPDATE ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_boleto_reminders
  BEFORE UPDATE ON public.boleto_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.abandoned_carts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boleto_reminders  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_reviews        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abandoned_carts: member or staff"
  ON public.abandoned_carts FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "abandoned_carts: system write"
  ON public.abandoned_carts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "wishlist: member or staff"
  ON public.wishlist_items FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "wishlist: system write"
  ON public.wishlist_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "boleto: member or staff"
  ON public.boleto_reminders FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "boleto: system write"
  ON public.boleto_reminders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "device_tokens: system write"
  ON public.device_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "cs_reviews: member or staff"
  ON public.cs_reviews FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "cs_reviews: system write"
  ON public.cs_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
