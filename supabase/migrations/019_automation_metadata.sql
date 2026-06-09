-- ============================================================
-- 019_automation_metadata.sql
-- Template config for WhatsApp flows (Fase 2B)
-- ============================================================

ALTER TABLE public.automation_flows
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';
