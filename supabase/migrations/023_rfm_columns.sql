-- ============================================================
-- 023_rfm_columns.sql
-- Add RFM segmentation columns to customers table.
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS rfm_segment     text,
  ADD COLUMN IF NOT EXISTS rfm_last_calc   timestamptz,
  ADD COLUMN IF NOT EXISTS rfm_recency_days integer,
  ADD COLUMN IF NOT EXISTS rfm_frequency   integer,
  ADD COLUMN IF NOT EXISTS rfm_monetary_cents bigint;

CREATE INDEX IF NOT EXISTS idx_customers_rfm_segment
  ON public.customers(rfm_segment)
  WHERE rfm_segment IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_rfm_last_calc
  ON public.customers(rfm_last_calc)
  WHERE rfm_last_calc IS NOT NULL;
