-- ============================================================
-- 028_fulfillly_wms.sql
-- Fulfillly WMS: products enrichment, warehouse addressing,
-- stock ledger, receiving, inventory counts, lots, quarantine
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS length_mm integer,
  ADD COLUMN IF NOT EXISTS width_mm integer,
  ADD COLUMN IF NOT EXISTS height_mm integer,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS min_stock_units integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(client_id, barcode)
  WHERE barcode IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  aisle       text        NOT NULL,
  shelf       text        NOT NULL,
  level       text        NOT NULL DEFAULT '1',
  bin_code    text        NOT NULL,
  route_order integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, bin_code)
);

CREATE TABLE IF NOT EXISTS public.product_lots (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id  uuid        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_code    text        NOT NULL,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, product_id, lot_code)
);

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku         text        NOT NULL,
  location_id uuid        NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  qty         integer     NOT NULL DEFAULT 0 CHECK (qty >= 0),
  lot_id      uuid        REFERENCES public.product_lots(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, sku, location_id, lot_id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku             text        NOT NULL,
  movement_type   text        NOT NULL
                              CHECK (movement_type IN ('entrada','saida','ajuste','devolucao','reserva','commit','transferencia')),
  qty             integer     NOT NULL,
  reference_type  text,
  reference_id    uuid,
  user_id         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason          text,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku         text        NOT NULL,
  delta       integer     NOT NULL,
  reason      text        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  movement_id uuid        REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receiving_appointments (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  scheduled_at    timestamptz NOT NULL,
  expected_items  jsonb       NOT NULL DEFAULT '[]',
  status          text        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.receiving_sessions (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id  uuid        REFERENCES public.receiving_appointments(id) ON DELETE SET NULL,
  operator_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','completed','cancelled')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  metadata        jsonb       NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.receiving_lines (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      uuid        NOT NULL REFERENCES public.receiving_sessions(id) ON DELETE CASCADE,
  sku             text        NOT NULL,
  expected_qty    integer     NOT NULL DEFAULT 0,
  received_qty    integer     NOT NULL DEFAULT 0,
  barcode_scanned text,
  has_divergence  boolean     NOT NULL DEFAULT false,
  photo_url       text,
  location_id     uuid        REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  count_type  text        NOT NULL CHECK (count_type IN ('rotativo','geral')),
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed')),
  started_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.inventory_count_lines (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  count_id        uuid        NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  sku             text        NOT NULL,
  location_id     uuid        REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  system_qty      integer     NOT NULL DEFAULT 0,
  counted_qty     integer,
  divergence      integer     GENERATED ALWAYS AS (COALESCE(counted_qty, 0) - system_qty) STORED
);

CREATE TABLE IF NOT EXISTS public.quarantine_items (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku         text        NOT NULL,
  qty         integer     NOT NULL CHECK (qty > 0),
  reason      text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','released','discarded')),
  inspected_by uuid       REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_warehouse_client ON public.warehouse_locations(client_id, route_order);
CREATE INDEX IF NOT EXISTS idx_inv_loc_sku ON public.inventory_locations(client_id, sku);
CREATE INDEX IF NOT EXISTS idx_stock_mov_sku ON public.stock_movements(client_id, sku, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receiving_appt ON public.receiving_appointments(client_id, scheduled_at);

CREATE TRIGGER set_updated_at_warehouse_locations
  BEFORE UPDATE ON public.warehouse_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_inventory_locations
  BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_receiving_appointments
  BEFORE UPDATE ON public.receiving_appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.warehouse_locations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_lots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarantine_items      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouse_locations: member or staff"
  ON public.warehouse_locations FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "warehouse_locations: system write"
  ON public.warehouse_locations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "inventory_locations: member or staff"
  ON public.inventory_locations FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "inventory_locations: system write"
  ON public.inventory_locations FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "stock_movements: member or staff"
  ON public.stock_movements FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "stock_movements: system write"
  ON public.stock_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "stock_adjustments: member or staff"
  ON public.stock_adjustments FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "stock_adjustments: system write"
  ON public.stock_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "receiving: member or staff"
  ON public.receiving_appointments FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "receiving_appt: system write"
  ON public.receiving_appointments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "receiving_sessions: system write"
  ON public.receiving_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "receiving_lines: system write"
  ON public.receiving_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "inventory_counts: member or staff"
  ON public.inventory_counts FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "inventory_counts: system write"
  ON public.inventory_counts FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "quarantine: member or staff"
  ON public.quarantine_items FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "quarantine: system write"
  ON public.quarantine_items FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fulfillment-evidence', 'fulfillment-evidence', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fulfillment_evidence: service role all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'fulfillment-evidence')
  WITH CHECK (bucket_id = 'fulfillment-evidence');
