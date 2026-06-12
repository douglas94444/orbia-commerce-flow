-- SLA penalties + per-client rule overrides

ALTER TABLE public.channel_sla_rules
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS tracking_deadline_hours integer,
  ADD COLUMN IF NOT EXISTS penalty_description text;

ALTER TABLE public.channel_sla_rules DROP CONSTRAINT IF EXISTS channel_sla_rules_channel_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_sla_rules_global
  ON public.channel_sla_rules (channel) WHERE client_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_sla_rules_client
  ON public.channel_sla_rules (channel, client_id) WHERE client_id IS NOT NULL;

UPDATE public.channel_sla_rules SET tracking_deadline_hours = 24, penalty_description = 'Tracking tardio pode gerar penalidade no marketplace'
  WHERE channel = 'mercado_livre' AND client_id IS NULL;

UPDATE public.channel_sla_rules SET tracking_deadline_hours = 12, penalty_description = 'Late shipment — Shopee penaliza envio fora do prazo'
  WHERE channel = 'shopee' AND client_id IS NULL;

UPDATE public.channel_sla_rules SET tracking_deadline_hours = 24, penalty_description = 'Amazon late shipment rate'
  WHERE channel = 'amazon' AND client_id IS NULL;
