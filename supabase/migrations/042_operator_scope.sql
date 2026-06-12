-- Escopo operador de galpão: SKUs e galpão permitidos

ALTER TABLE public.client_members
  ADD COLUMN IF NOT EXISTS allowed_skus text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS warehouse_scope_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_members_warehouse_scope
  ON public.client_members(warehouse_scope_id)
  WHERE warehouse_scope_id IS NOT NULL;

COMMENT ON COLUMN public.client_members.allowed_skus IS 'SKUs permitidos para fulfillment_operator; vazio = todos';
COMMENT ON COLUMN public.client_members.warehouse_scope_id IS 'Galpão restrito para fulfillment_operator; null = todos';
