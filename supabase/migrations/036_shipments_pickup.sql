-- Shipments history + coleta agendada metadata

CREATE TABLE IF NOT EXISTS public.shipments (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id              uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider              text        NOT NULL,
  tracking_code         text,
  shipment_external_id  text,
  label_url             text,
  status                text        NOT NULL DEFAULT 'created'
                                    CHECK (status IN ('created', 'cancelled')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_client ON public.shipments(client_id, created_at DESC);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments: member or staff"
  ON public.shipments FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "shipments: system write"
  ON public.shipments FOR ALL TO service_role USING (true) WITH CHECK (true);
