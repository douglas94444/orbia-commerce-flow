-- Multi-tenant: operadores de galpão + embalagem personalizada

ALTER TABLE public.client_members
  DROP CONSTRAINT IF EXISTS client_members_role_check;

ALTER TABLE public.client_members
  ADD CONSTRAINT client_members_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'viewer', 'fulfillment_operator'));

CREATE TABLE IF NOT EXISTS public.client_packing_profiles (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid        NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  checklist_items     jsonb       NOT NULL DEFAULT '[]',
  branding_url        text,
  insert_material_sku text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_client_packing_profiles
  BEFORE UPDATE ON public.client_packing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_packing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packing_profiles: member or staff"
  ON public.client_packing_profiles FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "packing_profiles: member write"
  ON public.client_packing_profiles FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "carrier_configs: member write"
  ON public.client_carrier_configs FOR INSERT
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "carrier_configs: member update"
  ON public.client_carrier_configs FOR UPDATE
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());
