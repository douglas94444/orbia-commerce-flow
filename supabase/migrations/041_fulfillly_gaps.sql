-- Fulfillly gaps: coletas agendadas, penalidades marketplace, multi-galpão

CREATE TABLE IF NOT EXISTS public.carrier_pickups (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider        text        NOT NULL,
  scheduled_at    timestamptz NOT NULL,
  order_count     integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carrier_pickups_client ON public.carrier_pickups(client_id, scheduled_at DESC);

CREATE TRIGGER set_updated_at_carrier_pickups
  BEFORE UPDATE ON public.carrier_pickups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.carrier_pickups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_pickups: member or staff"
  ON public.carrier_pickups FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "carrier_pickups: member write"
  ON public.carrier_pickups FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE TABLE IF NOT EXISTS public.marketplace_penalty_records (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id        uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  channel         text        NOT NULL,
  penalty_type    text        NOT NULL CHECK (penalty_type IN ('late_tracking', 'missing_nf', 'sla_breach')),
  amount_cents    bigint      NOT NULL DEFAULT 0,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_penalty_records_client ON public.marketplace_penalty_records(client_id, created_at DESC);

ALTER TABLE public.marketplace_penalty_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "penalty_records: member or staff"
  ON public.marketplace_penalty_records FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "penalty_records: system write"
  ON public.marketplace_penalty_records FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.warehouses (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  code        text        NOT NULL,
  is_default  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, code)
);

CREATE TRIGGER set_updated_at_warehouses
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses: member or staff"
  ON public.warehouses FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "warehouses: member write"
  ON public.warehouses FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

ALTER TABLE public.warehouse_locations
  ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;
