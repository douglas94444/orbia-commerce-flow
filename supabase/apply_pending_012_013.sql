-- Cole no SQL Editor: https://supabase.com/dashboard/project/ztaozvgmzycetiwwkhjc/sql/new

ALTER TABLE public.fiscal_configs
  ADD COLUMN IF NOT EXISTS cert_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('fiscal-certificates', 'fiscal-certificates', false, 5242880, ARRAY['application/x-pkcs12', 'application/octet-stream']),
  ('nfe-xml', 'nfe-xml', false, 10485760, ARRAY['application/xml', 'text/xml', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fiscal_certificates: service role all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'fiscal-certificates')
  WITH CHECK (bucket_id = 'fiscal-certificates');

CREATE POLICY "nfe_xml: service role all"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'nfe-xml')
  WITH CHECK (bucket_id = 'nfe-xml');
