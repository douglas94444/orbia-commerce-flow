-- ============================================================
-- 017_mercado_pago_provider.sql
-- Add mercado_pago as billing provider (Fase 2B)
-- ============================================================

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_provider_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_check
  CHECK (provider IN ('stripe', 'pagar_me', 'manual', 'mercado_pago'));

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_provider_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_provider_check
  CHECK (provider IN ('stripe', 'pagar_me', 'manual', 'mercado_pago'));
