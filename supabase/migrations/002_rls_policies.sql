-- ============================================================
-- 002_rls_policies.sql
-- Security boundary functions + RLS policies for core tables.
-- These functions are called by every policy — never trust frontend input.
-- ============================================================

-- ─── Security functions ─────────────────────────────────────

-- Resolves the active client_id for the current JWT user.
-- Called by all RLS policies. client_id NEVER comes from the frontend.
CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id
  FROM public.client_members
  WHERE user_id  = auth.uid()
    AND status   = 'active'
  LIMIT 1;
$$;

-- Returns true if the current user is internal Orbia staff.
CREATE OR REPLACE FUNCTION public.is_orbia_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role IN ('orbia_admin', 'orbia_staff')
  );
$$;

-- ─── profiles ────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own row or staff"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_orbia_staff());

CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- No DELETE policy — profiles cascade from auth.users deletion only.

-- ─── clients ─────────────────────────────────────────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: member or staff"
  ON public.clients FOR SELECT
  USING (id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "clients: staff insert"
  ON public.clients FOR INSERT
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "clients: staff update"
  ON public.clients FOR UPDATE
  USING (public.is_orbia_staff());

-- No DELETE policy — clients are never hard-deleted; use status = 'cancelled'.

-- ─── client_members ──────────────────────────────────────────
ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_members: visible to tenant and staff"
  ON public.client_members FOR SELECT
  USING (
    client_id = public.current_client_id()
    OR user_id = auth.uid()
    OR public.is_orbia_staff()
  );

CREATE POLICY "client_members: staff insert"
  ON public.client_members FOR INSERT
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "client_members: staff update"
  ON public.client_members FOR UPDATE
  USING (public.is_orbia_staff());

CREATE POLICY "client_members: staff delete"
  ON public.client_members FOR DELETE
  USING (public.is_orbia_staff());
