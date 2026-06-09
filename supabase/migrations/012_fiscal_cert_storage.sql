-- Migration 012: add cert_path to fiscal_configs
-- Stores the Supabase Storage path to the encrypted A1 certificate.
-- The certificate file is stored in the private 'fiscal-certificates' bucket.
-- Only the path is stored here — the file is never returned to the browser.

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS cert_path text;
