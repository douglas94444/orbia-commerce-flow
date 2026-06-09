-- ============================================================
-- 013_storage_buckets.sql
-- Private buckets for fiscal certificates and NF-e XML/DANFE.
-- Only service_role writes; browser never receives raw files.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'fiscal-certificates',
    'fiscal-certificates',
    false,
    5242880,  -- 5 MB
    ARRAY['application/x-pkcs12', 'application/octet-stream']
  ),
  (
    'nfe-xml',
    'nfe-xml',
    false,
    10485760, -- 10 MB
    ARRAY['application/xml', 'text/xml', 'application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- Service role: full access (webhook processors, fiscal emission)
CREATE POLICY "fiscal_certificates: service role all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'fiscal-certificates')
  WITH CHECK (bucket_id = 'fiscal-certificates');

CREATE POLICY "nfe_xml: service role all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'nfe-xml')
  WITH CHECK (bucket_id = 'nfe-xml');

-- No policies for authenticated — default deny; app uses service role for file I/O.
