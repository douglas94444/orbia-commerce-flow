-- ============================================================
-- 007_orders.sql
-- orders, order_events, inventory — Módulo Logística
-- ============================================================

CREATE TABLE public.orders (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  external_id text        NOT NULL,   -- provider's order ID
  channel     text        NOT NULL,   -- 'mercado_livre' | 'shopee' | 'amazon' | 'tiktok' | 'instagram' | 'nuvemshop' | 'shopify'
  status      text        NOT NULL DEFAULT 'aguardando_nf'
                          CHECK (status IN ('aguardando_nf','separacao','despachado','em_transito','entregue','cancelado','devolvido')),
  nf_status   text        NOT NULL DEFAULT 'pendente'
                          CHECK (nf_status IN ('autorizada','pendente','rejeitada')),
  carrier     text,
  value_cents bigint      NOT NULL,
  city        text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, channel, external_id)
);

CREATE TABLE public.order_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status      text        NOT NULL,
  source      text        NOT NULL DEFAULT 'system',
  metadata    jsonb       NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku         text        NOT NULL,
  product     text        NOT NULL,
  units       integer     NOT NULL DEFAULT 0,
  reserved    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, sku)
);

-- Indexes
CREATE INDEX idx_orders_client_id   ON public.orders(client_id);
CREATE INDEX idx_orders_status      ON public.orders(status);
CREATE INDEX idx_orders_channel     ON public.orders(channel);
CREATE INDEX idx_orders_created_at  ON public.orders(created_at DESC);
CREATE INDEX idx_order_events_order ON public.order_events(order_id);
CREATE INDEX idx_inventory_client   ON public.inventory(client_id);

-- Triggers
CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_inventory
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: member or staff"
  ON public.orders FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "orders: system insert"
  ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "orders: system update"
  ON public.orders FOR UPDATE USING (true);

CREATE POLICY "order_events: member or staff"
  ON public.order_events FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE client_id = public.current_client_id()
    ) OR public.is_orbia_staff()
  );

CREATE POLICY "order_events: system insert"
  ON public.order_events FOR INSERT WITH CHECK (true);

CREATE POLICY "inventory: member or staff"
  ON public.inventory FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "inventory: system write"
  ON public.inventory FOR ALL USING (true);
