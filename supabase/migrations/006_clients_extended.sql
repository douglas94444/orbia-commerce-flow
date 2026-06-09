-- ============================================================
-- 006_clients_extended.sql
-- Adds denormalized performance columns to clients.
-- Updated by background jobs (order sync, campaign sync, CS system).
-- Phase 3 modules write to these; Phase 2 reads them (default 0).
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN gmv_30d           bigint   NOT NULL DEFAULT 0,          -- last 30d GMV in BRL cents
  ADD COLUMN roas_avg          numeric(5,2) NOT NULL DEFAULT 0,      -- weighted avg ROAS across all channels
  ADD COLUMN last_contact_days smallint NOT NULL DEFAULT 0,          -- days since last CS contact
  ADD COLUMN onboarding_week   smallint NOT NULL DEFAULT 1           -- current onboarding week (1–4)
                               CHECK (onboarding_week BETWEEN 1 AND 4);

COMMENT ON COLUMN public.clients.gmv_30d           IS 'Rolling 30-day GMV in BRL cents. Updated by order-sync job.';
COMMENT ON COLUMN public.clients.roas_avg          IS 'Weighted avg ROAS across Meta + Google. Updated by campaign-sync job.';
COMMENT ON COLUMN public.clients.last_contact_days IS 'Days since last CS contact. Updated by CS module.';
COMMENT ON COLUMN public.clients.onboarding_week   IS 'Current onboarding week (1=setup, 2=traffic, 3=logistics, 4=retention).';
