-- ============================================================
-- 031_reverse_logistics.sql
-- Returns, inspections, refunds
-- ============================================================

CREATE TABLE IF NOT EXISTS public.return_requests (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id        uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id     uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  reason          text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','in_transit','received','inspected','completed','cancelled')),
  approval_mode   text        NOT NULL DEFAULT 'manual'
                              CHECK (approval_mode IN ('auto','manual')),
  return_label_url text,
  tracking_code   text,
  refund_cents    bigint,
  credit_issued   boolean     NOT NULL DEFAULT false,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.return_items (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  return_request_id uuid        NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  order_item_id     uuid        REFERENCES public.order_items(id) ON DELETE SET NULL,
  sku               text        NOT NULL,
  qty               integer     NOT NULL CHECK (qty > 0),
  condition_notes   text
);

CREATE TABLE IF NOT EXISTS public.return_inspections (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  return_request_id uuid        NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  inspector_id      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  destination       text        NOT NULL
                                CHECK (destination IN ('reintegrate','quarantine','discard')),
  photo_urls        jsonb       NOT NULL DEFAULT '[]',
  notes             text,
  inspected_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_client ON public.return_requests(client_id, status);
CREATE INDEX IF NOT EXISTS idx_return_requests_order ON public.return_requests(order_id);

CREATE TRIGGER set_updated_at_return_requests
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.return_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "return_requests: member or staff"
  ON public.return_requests FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "return_requests: system write"
  ON public.return_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "return_items: system write"
  ON public.return_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "return_inspections: system write"
  ON public.return_inspections FOR ALL TO service_role USING (true) WITH CHECK (true);
