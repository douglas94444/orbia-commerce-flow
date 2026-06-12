-- Tráfego: atribuição de pedidos entregues a campanhas

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS attributed_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attribution_source text,
  ADD COLUMN IF NOT EXISTS attribution_meta jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_orders_attributed_campaign
  ON public.orders(attributed_campaign_id)
  WHERE attributed_campaign_id IS NOT NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS attributed_revenue_cents bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.order_attributions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      uuid        NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaign_id   uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  value_cents   bigint      NOT NULL,
  source        text        NOT NULL,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_attributions_campaign
  ON public.order_attributions(campaign_id);

CREATE INDEX IF NOT EXISTS idx_order_attributions_client
  ON public.order_attributions(client_id, attributed_at DESC);

ALTER TABLE public.order_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_attributions: member or staff"
  ON public.order_attributions FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());
