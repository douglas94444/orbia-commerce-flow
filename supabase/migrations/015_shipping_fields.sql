-- ============================================================
-- 015_shipping_fields.sql
-- Tracking + Melhor Envio shipment reference on orders.
-- ============================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipment_external_id text;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON public.orders(tracking_code)
  WHERE tracking_code IS NOT NULL;
