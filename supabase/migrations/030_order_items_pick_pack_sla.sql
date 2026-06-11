-- ============================================================
-- 030_order_items_pick_pack_sla.sql
-- order_items, picking/packing, SLA rules
-- ============================================================

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'aguardando_nf','separacao','em_picking','em_packing',
    'despachado','em_transito','entregue','cancelado','devolvido'
  ));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sla_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_alert_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_breached boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.order_items (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id          uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku               text        NOT NULL,
  qty               integer     NOT NULL CHECK (qty > 0),
  unit_price_cents  bigint      NOT NULL DEFAULT 0,
  product_id        uuid        REFERENCES public.products(id) ON DELETE SET NULL,
  picked_qty        integer     NOT NULL DEFAULT 0,
  packed_qty        integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_sla ON public.orders(sla_deadline_at) WHERE sla_breached = false;

CREATE TABLE IF NOT EXISTS public.channel_sla_rules (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  channel               text        NOT NULL UNIQUE,
  dispatch_hours        integer     NOT NULL,
  alert_hours_before    integer     NOT NULL DEFAULT 4,
  created_at            timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.channel_sla_rules (channel, dispatch_hours, alert_hours_before) VALUES
  ('shopee', 24, 4),
  ('mercado_livre', 48, 6),
  ('amazon', 72, 8),
  ('nuvemshop', 48, 6),
  ('shopify', 48, 6),
  ('tiktok', 24, 4),
  ('instagram', 48, 6)
ON CONFLICT (channel) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pick_waves (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','in_progress','completed','cancelled')),
  priority    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.pick_tasks (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  wave_id       uuid        NOT NULL REFERENCES public.pick_waves(id) ON DELETE CASCADE,
  order_id      uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  operator_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','completed','issue')),
  route_order   integer     NOT NULL DEFAULT 0,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pick_task_lines (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id       uuid        NOT NULL REFERENCES public.pick_tasks(id) ON DELETE CASCADE,
  order_item_id uuid        NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  location_id   uuid        REFERENCES public.warehouse_locations(id) ON DELETE SET NULL,
  sku           text        NOT NULL,
  qty_required  integer     NOT NULL,
  qty_picked    integer     NOT NULL DEFAULT 0,
  sort_order    integer     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','picked','not_found','skipped'))
);

CREATE TABLE IF NOT EXISTS public.packing_sessions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  operator_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  status        text        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','completed','cancelled')),
  box_type      text,
  photo_urls    jsonb       NOT NULL DEFAULT '[]',
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE TABLE IF NOT EXISTS public.delivery_incidents (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  incident_type text        NOT NULL,
  description text,
  resolved    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pick_waves_client ON public.pick_waves(client_id, status);
CREATE INDEX IF NOT EXISTS idx_pick_tasks_wave ON public.pick_tasks(wave_id);
CREATE INDEX IF NOT EXISTS idx_packing_order ON public.packing_sessions(order_id);

ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_sla_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_waves         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_task_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packing_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items: member or staff"
  ON public.order_items FOR SELECT
  USING (
    order_id IN (SELECT id FROM public.orders WHERE client_id = public.current_client_id())
    OR public.is_orbia_staff()
  );

CREATE POLICY "order_items: system write"
  ON public.order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "channel_sla: read all"
  ON public.channel_sla_rules FOR SELECT USING (true);

CREATE POLICY "pick_waves: member or staff"
  ON public.pick_waves FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "pick_waves: system write"
  ON public.pick_waves FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pick_tasks: system write"
  ON public.pick_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pick_task_lines: system write"
  ON public.pick_task_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "packing_sessions: system write"
  ON public.packing_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "delivery_incidents: member or staff"
  ON public.delivery_incidents FOR SELECT
  USING (
    order_id IN (SELECT id FROM public.orders WHERE client_id = public.current_client_id())
    OR public.is_orbia_staff()
  );

CREATE POLICY "delivery_incidents: system write"
  ON public.delivery_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Migrate existing order items from metadata
INSERT INTO public.order_items (order_id, sku, qty, unit_price_cents)
SELECT
  o.id,
  item->>'sku',
  COALESCE((item->>'quantity')::integer, (item->>'qty')::integer, 1),
  COALESCE((item->>'unitPriceCents')::bigint, 0)
FROM public.orders o,
  jsonb_array_elements(COALESCE(o.metadata->'items', '[]'::jsonb)) AS item
WHERE jsonb_array_length(COALESCE(o.metadata->'items', '[]'::jsonb)) > 0
  AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id);
