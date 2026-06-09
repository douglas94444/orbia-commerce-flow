-- ============================================================
-- 001_core_tables.sql
-- Profiles, clients, client_members — multi-tenant foundation
-- ============================================================

-- Shared trigger: auto-updates updated_at on every table that uses it
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── profiles ───────────────────────────────────────────────
-- Extends auth.users. One row per auth user. Auto-created on signup.
CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  role        text        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('orbia_admin', 'orbia_staff', 'member')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── clients ────────────────────────────────────────────────
-- Root entity of multi-tenancy. One row per lojista account managed by Orbia.
CREATE TABLE public.clients (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text        NOT NULL,
  slug          text        UNIQUE NOT NULL,
  plan          text        NOT NULL DEFAULT 'launch'
                            CHECK (plan IN ('launch', 'growth', 'scale')),
  status        text        NOT NULL DEFAULT 'onboarding'
                            CHECK (status IN ('onboarding', 'active', 'suspended', 'cancelled')),
  segment       text,
  health_score  smallint    NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_slug   ON public.clients(slug);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_clients_plan   ON public.clients(plan);

CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── client_members ─────────────────────────────────────────
-- Maps auth users to clients. This is how multi-tenancy is resolved at DB level.
-- auth.current_client_id() (migration 002) reads from this table.
CREATE TABLE public.client_members (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'viewer'
                          CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

CREATE INDEX idx_client_members_user_id   ON public.client_members(user_id);
CREATE INDEX idx_client_members_client_id ON public.client_members(client_id);
CREATE INDEX idx_client_members_status    ON public.client_members(status);

CREATE TRIGGER set_updated_at_client_members
  BEFORE UPDATE ON public.client_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
