-- ============================================================
-- 049_channel_fees.sql
-- Per-order channel fee snapshots for profitability
-- ============================================================

CREATE TABLE IF NOT EXISTS public.channel_fee_snapshots (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id              uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  channel               text        NOT NULL,
  gmv_cents             bigint      NOT NULL DEFAULT 0,
  marketplace_fee_cents bigint      NOT NULL DEFAULT 0,
  shipping_fee_cents    bigint      NOT NULL DEFAULT 0,
  payment_fee_cents     bigint      NOT NULL DEFAULT 0,
  other_fee_cents       bigint      NOT NULL DEFAULT 0,
  net_revenue_cents     bigint      NOT NULL DEFAULT 0,
  metadata              jsonb       NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_fee_snapshots_client
  ON public.channel_fee_snapshots(client_id, channel, created_at DESC);

CREATE TRIGGER set_updated_at_channel_fee_snapshots
  BEFORE UPDATE ON public.channel_fee_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.channel_fee_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_fee_snapshots: member or staff"
  ON public.channel_fee_snapshots FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "channel_fee_snapshots: service write"
  ON public.channel_fee_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.channel_fee_snapshots FROM anon, authenticated;
