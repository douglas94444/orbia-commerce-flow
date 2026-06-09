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
-- ============================================================
-- 002_rls_policies.sql
-- Security boundary functions + RLS policies for core tables.
-- These functions are called by every policy — never trust frontend input.
-- ============================================================

-- ─── Security functions ─────────────────────────────────────

-- Resolves the active client_id for the current JWT user.
-- Called by all RLS policies. client_id NEVER comes from the frontend.
CREATE OR REPLACE FUNCTION auth.current_client_id()
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
CREATE OR REPLACE FUNCTION auth.is_orbia_staff()
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
  USING (id = auth.uid() OR auth.is_orbia_staff());

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
  USING (id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "clients: staff insert"
  ON public.clients FOR INSERT
  WITH CHECK (auth.is_orbia_staff());

CREATE POLICY "clients: staff update"
  ON public.clients FOR UPDATE
  USING (auth.is_orbia_staff());

-- No DELETE policy — clients are never hard-deleted; use status = 'cancelled'.

-- ─── client_members ──────────────────────────────────────────
ALTER TABLE public.client_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_members: visible to tenant and staff"
  ON public.client_members FOR SELECT
  USING (
    client_id = auth.current_client_id()
    OR user_id = auth.uid()
    OR auth.is_orbia_staff()
  );

CREATE POLICY "client_members: staff insert"
  ON public.client_members FOR INSERT
  WITH CHECK (auth.is_orbia_staff());

CREATE POLICY "client_members: staff update"
  ON public.client_members FOR UPDATE
  USING (auth.is_orbia_staff());

CREATE POLICY "client_members: staff delete"
  ON public.client_members FOR DELETE
  USING (auth.is_orbia_staff());
-- ============================================================
-- 003_observability.sql
-- audit_logs, integration_logs, job_logs.
-- Created in migration 003 so all business tables can reference them.
-- audit_logs and integration_logs are IMMUTABLE — no UPDATE or DELETE ever.
-- ============================================================

-- ─── audit_logs ──────────────────────────────────────────────
-- Records every user-driven state mutation. Immutable audit trail.
CREATE TABLE public.audit_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id   uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  action      text        NOT NULL,  -- 'create' | 'update' | 'delete' | 'login' | 'oauth_connect'
  resource    text        NOT NULL,  -- table or entity name: 'client' | 'order' | 'campaign'
  resource_id text,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
  -- No updated_at: rows are immutable
);

CREATE INDEX idx_audit_logs_client_id  ON public.audit_logs(client_id);
CREATE INDEX idx_audit_logs_user_id    ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action     ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Clients see their own audit trail; staff sees everything.
CREATE POLICY "audit_logs: member or staff"
  ON public.audit_logs FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

-- Only service role inserts (never anon/frontend directly).
-- WITH CHECK (true) allows service role inserts while anon cannot.
CREATE POLICY "audit_logs: system insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- No UPDATE. No DELETE. Ever.

-- ─── integration_logs ────────────────────────────────────────
-- Records every call to an external API. Immutable.
CREATE TABLE public.integration_logs (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  provider       text        NOT NULL,  -- 'meta' | 'google' | 'mercado_livre' | 'sefaz' | 'claude'
  operation      text        NOT NULL,  -- 'sync_campaigns' | 'emit_nfe' | 'chat_completion'
  status         text        NOT NULL   CHECK (status IN ('success', 'error', 'timeout', 'retrying')),
  request_hash   text,                  -- SHA-256 of sanitized payload (no PII)
  response_code  smallint,
  duration_ms    integer,
  error_message  text,
  metadata       jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
  -- No updated_at: immutable
);

CREATE INDEX idx_integration_logs_client_id  ON public.integration_logs(client_id);
CREATE INDEX idx_integration_logs_provider   ON public.integration_logs(provider);
CREATE INDEX idx_integration_logs_status     ON public.integration_logs(status);
CREATE INDEX idx_integration_logs_created_at ON public.integration_logs(created_at DESC);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_logs: member or staff"
  ON public.integration_logs FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "integration_logs: system insert"
  ON public.integration_logs FOR INSERT
  WITH CHECK (true);

-- No UPDATE. No DELETE. Ever.

-- ─── job_logs ────────────────────────────────────────────────
-- Tracks async job execution: webhooks, crons, sync operations.
-- Unlike audit/integration logs, job_logs CAN be updated (status transitions).
CREATE TABLE public.job_logs (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type    text        NOT NULL,  -- 'webhook' | 'nfe_retry' | 'stock_sync' | 'report'
  job_id      text,                  -- external reference (Inngest ID, BullMQ job ID)
  client_id   uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  status      text        NOT NULL   CHECK (status IN ('started', 'completed', 'failed', 'retrying')),
  attempts    smallint    NOT NULL DEFAULT 0,
  duration_ms integer,
  error       text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_logs_client_id  ON public.job_logs(client_id);
CREATE INDEX idx_job_logs_status     ON public.job_logs(status);
CREATE INDEX idx_job_logs_job_type   ON public.job_logs(job_type);
CREATE INDEX idx_job_logs_created_at ON public.job_logs(created_at DESC);

ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_logs: member or staff"
  ON public.job_logs FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "job_logs: system insert"
  ON public.job_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "job_logs: system update"
  ON public.job_logs FOR UPDATE
  USING (true);

CREATE TRIGGER set_updated_at_job_logs
  BEFORE UPDATE ON public.job_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ============================================================
-- 004_webhooks.sql
-- Idempotent webhook event storage and processing tracking.
-- UNIQUE(provider, event_id) is the hard idempotency constraint.
-- Assume providers will send: duplicates, delays, out-of-order events.
-- ============================================================

CREATE TABLE public.webhook_events (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider        text        NOT NULL,  -- 'mercado_livre' | 'shopee' | 'amazon' | 'tiktok' | 'shopify' | 'nuvemshop'
  event_id        text        NOT NULL,  -- provider's unique event ID — used for idempotency
  event_type      text        NOT NULL,  -- 'order.created' | 'payment.approved' | 'stock.updated'
  client_id       uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  payload         jsonb       NOT NULL,
  status          text        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'processing', 'processed', 'failed', 'dead')),
  attempts        smallint    NOT NULL DEFAULT 0,
  max_attempts    smallint    NOT NULL DEFAULT 3,
  last_error      text,
  processed_at    timestamptz,
  next_retry_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Hard idempotency: same provider + event_id is never inserted twice
  UNIQUE(provider, event_id)
);

CREATE INDEX idx_webhook_events_status     ON public.webhook_events(status);
CREATE INDEX idx_webhook_events_provider   ON public.webhook_events(provider);
CREATE INDEX idx_webhook_events_client_id  ON public.webhook_events(client_id);
CREATE INDEX idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Partial index for the retry queue — only failed events eligible for retry
CREATE INDEX idx_webhook_events_retry
  ON public.webhook_events(next_retry_at)
  WHERE status = 'failed' AND attempts < max_attempts;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Written only by service role (server). Never from the browser.
CREATE POLICY "webhook_events: member or staff"
  ON public.webhook_events FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "webhook_events: system insert"
  ON public.webhook_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "webhook_events: system update"
  ON public.webhook_events FOR UPDATE
  USING (true);

CREATE TRIGGER set_updated_at_webhook_events
  BEFORE UPDATE ON public.webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- ============================================================
-- 005_oauth.sql
-- OAuth connections (token storage) and ephemeral state management.
-- Tokens are stored encrypted — use pgsodium in production.
-- ============================================================

-- ─── oauth_connections ───────────────────────────────────────
-- Stores live OAuth tokens per client per provider.
-- access_token and refresh_token are encrypted at rest.
-- Frontend NEVER reads tokens — server functions handle all token use.
CREATE TABLE public.oauth_connections (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider          text        NOT NULL,  -- 'meta' | 'google' | 'mercado_livre' | 'shopify' | 'nuvemshop'
  external_account  text,                  -- Ad Account ID, Shop ID, Seller ID (provider-specific)
  access_token      text        NOT NULL,  -- encrypted via pgsodium
  refresh_token     text,                  -- encrypted via pgsodium
  token_expires_at  timestamptz,
  scopes            text[],
  is_active         boolean     NOT NULL DEFAULT true,
  last_refreshed_at timestamptz,
  metadata          jsonb       NOT NULL DEFAULT '{}',  -- shop_name, account_name, etc.
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, provider, external_account)
);

CREATE INDEX idx_oauth_connections_client_id ON public.oauth_connections(client_id);
CREATE INDEX idx_oauth_connections_provider  ON public.oauth_connections(provider);
-- Partial index: find active tokens nearing expiry for background refresh
CREATE INDEX idx_oauth_connections_expiry
  ON public.oauth_connections(token_expires_at)
  WHERE is_active = true;

ALTER TABLE public.oauth_connections ENABLE ROW LEVEL SECURITY;

-- Clients can see WHICH providers are connected (no token values exposed in UI).
CREATE POLICY "oauth_connections: member or staff"
  ON public.oauth_connections FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

-- Token writes go through server functions only (service role or staff-scoped client).
CREATE POLICY "oauth_connections: staff write"
  ON public.oauth_connections FOR INSERT
  WITH CHECK (auth.is_orbia_staff());

CREATE POLICY "oauth_connections: staff update"
  ON public.oauth_connections FOR UPDATE
  USING (auth.is_orbia_staff());

-- Clients can revoke their own connections; staff can revoke any.
CREATE POLICY "oauth_connections: member or staff delete"
  ON public.oauth_connections FOR DELETE
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE TRIGGER set_updated_at_oauth_connections
  BEFORE UPDATE ON public.oauth_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── oauth_states ────────────────────────────────────────────
-- Ephemeral state + nonce for OAuth PKCE/state validation.
-- TTL: 10 minutes. Deleted immediately after use.
CREATE TABLE public.oauth_states (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  state       text        UNIQUE NOT NULL,   -- random value sent to provider as ?state=
  nonce       text        NOT NULL,          -- PKCE code_verifier or nonce for validation
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid        REFERENCES public.clients(id) ON DELETE CASCADE,
  provider    text        NOT NULL,
  redirect_to text,                          -- post-OAuth redirect destination
  metadata    jsonb       NOT NULL DEFAULT '{}',
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at  timestamptz NOT NULL DEFAULT now()
  -- No updated_at: single-use, deleted after callback
);

CREATE INDEX idx_oauth_states_state      ON public.oauth_states(state);
CREATE INDEX idx_oauth_states_user_id    ON public.oauth_states(user_id);
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own pending states.
CREATE POLICY "oauth_states: own row"
  ON public.oauth_states FOR ALL
  USING (user_id = auth.uid());

-- Cleanup function: delete expired states. Call via pg_cron or server cron.
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS integer
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.oauth_states
    WHERE expires_at < now()
    RETURNING id
  )
  SELECT count(*)::integer FROM deleted;
$$;
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
-- ============================================================
-- 007_orders.sql
-- orders, order_events, inventory — Módulo Logística
-- ============================================================

CREATE TABLE public.orders (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  external_id text        NOT NULL,   -- provider's order ID
  channel     text        NOT NULL,   -- 'mercado_livre' | 'shopee' | 'amazon' | 'tiktok' | 'instagram' | 'nuvemshop' | 'shopify'
  status      text        NOT NULL DEFAULT 'aguardando_nf'
                          CHECK (status IN ('aguardando_nf','separacao','despachado','em_transito','entregue','cancelado','devolvido')),
  nf_status   text        NOT NULL DEFAULT 'pendente'
                          CHECK (nf_status IN ('autorizada','pendente','rejeitada')),
  carrier     text,
  value_cents bigint      NOT NULL,
  city        text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, channel, external_id)
);

CREATE TABLE public.order_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id    uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status      text        NOT NULL,
  source      text        NOT NULL DEFAULT 'system',
  metadata    jsonb       NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sku         text        NOT NULL,
  product     text        NOT NULL,
  units       integer     NOT NULL DEFAULT 0,
  reserved    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, sku)
);

-- Indexes
CREATE INDEX idx_orders_client_id   ON public.orders(client_id);
CREATE INDEX idx_orders_status      ON public.orders(status);
CREATE INDEX idx_orders_channel     ON public.orders(channel);
CREATE INDEX idx_orders_created_at  ON public.orders(created_at DESC);
CREATE INDEX idx_order_events_order ON public.order_events(order_id);
CREATE INDEX idx_inventory_client   ON public.inventory(client_id);

-- Triggers
CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_inventory
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders: member or staff"
  ON public.orders FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "orders: system insert"
  ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "orders: system update"
  ON public.orders FOR UPDATE USING (true);

CREATE POLICY "order_events: member or staff"
  ON public.order_events FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE client_id = auth.current_client_id()
    ) OR auth.is_orbia_staff()
  );

CREATE POLICY "order_events: system insert"
  ON public.order_events FOR INSERT WITH CHECK (true);

CREATE POLICY "inventory: member or staff"
  ON public.inventory FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "inventory: system write"
  ON public.inventory FOR ALL USING (true);
-- ============================================================
-- 008_campaigns.sql
-- ad_accounts, campaigns — Módulo Tráfego
-- ============================================================

CREATE TABLE public.ad_accounts (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  provider     text        NOT NULL CHECK (provider IN ('meta','google')),
  external_id  text        NOT NULL,
  name         text,
  currency     text        NOT NULL DEFAULT 'BRL',
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, provider, external_id)
);

CREATE TABLE public.campaigns (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_account_id   uuid        REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  external_id     text        NOT NULL,
  name            text        NOT NULL,
  platform        text        NOT NULL CHECK (platform IN ('meta','google')),
  status          text        NOT NULL DEFAULT 'ativa'
                              CHECK (status IN ('ativa','atencao','pausada')),
  spend_cents     bigint      NOT NULL DEFAULT 0,
  revenue_cents   bigint      NOT NULL DEFAULT 0,
  roas            numeric(5,2) NOT NULL DEFAULT 0,
  period_start    date,
  period_end      date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, platform, external_id)
);

CREATE INDEX idx_campaigns_client_id ON public.campaigns(client_id);
CREATE INDEX idx_campaigns_platform  ON public.campaigns(platform);
CREATE INDEX idx_campaigns_status    ON public.campaigns(status);

CREATE TRIGGER set_updated_at_ad_accounts
  BEFORE UPDATE ON public.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_campaigns
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_accounts: member or staff"
  ON public.ad_accounts FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "ad_accounts: system write"
  ON public.ad_accounts FOR ALL USING (true);

CREATE POLICY "campaigns: member or staff"
  ON public.campaigns FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "campaigns: system write"
  ON public.campaigns FOR ALL USING (true);
-- ============================================================
-- 009_fiscal.sql
-- nfe_emissions, fiscal_configs — Módulo Fiscal
-- XMLs e DANFEs são stored no Supabase Storage.
-- nfe_emissions é append-only (cancelamentos são novas linhas).
-- ============================================================

CREATE TABLE public.nfe_emissions (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  order_id      uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  external_ref  text,                 -- Focus NFe / Nuvem Fiscal reference
  type          text        NOT NULL  CHECK (type IN ('NF-e','NFC-e','NFS-e')),
  status        text        NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('autorizada','pendente','rejeitada','cancelada')),
  access_key    text        UNIQUE,   -- 44-digit SEFAZ key
  value_cents   bigint      NOT NULL,
  retries       smallint    NOT NULL DEFAULT 0,
  last_error    text,
  xml_url       text,                 -- Supabase Storage path (keep 5 years)
  danfe_url     text,
  authorized_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fiscal_configs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid        UNIQUE NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cnpj         text        NOT NULL,
  company_name text        NOT NULL,
  tax_regime   text        NOT NULL CHECK (tax_regime IN ('simples','lucro_presumido','lucro_real')),
  default_cfop text,
  default_cst  text,
  default_ncm  text,
  cert_expires_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfe_client_id  ON public.nfe_emissions(client_id);
CREATE INDEX idx_nfe_status     ON public.nfe_emissions(status);
CREATE INDEX idx_nfe_order_id   ON public.nfe_emissions(order_id);
CREATE INDEX idx_nfe_created_at ON public.nfe_emissions(created_at DESC);

CREATE TRIGGER set_updated_at_nfe
  BEFORE UPDATE ON public.nfe_emissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_fiscal_configs
  BEFORE UPDATE ON public.fiscal_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.nfe_emissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfe_emissions: member or staff"
  ON public.nfe_emissions FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "nfe_emissions: system write"
  ON public.nfe_emissions FOR ALL USING (true);

CREATE POLICY "fiscal_configs: member or staff"
  ON public.fiscal_configs FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "fiscal_configs: system write"
  ON public.fiscal_configs FOR ALL USING (true);
-- ============================================================
-- 010_retention.sql
-- customers (anonymized), automation_flows — Módulo Retenção
-- LGPD: email e telefone nunca armazenados em texto puro.
-- ============================================================

CREATE TABLE public.customers (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  external_id   text,                  -- Nuvemshop / Shopify customer ID
  email_hash    text        NOT NULL,  -- SHA-256 of email (LGPD)
  phone_hash    text,                  -- SHA-256 of phone (LGPD)
  rfm_score     text        NOT NULL DEFAULT 'indefinido'
                            CHECK (rfm_score IN ('campiao','fiel','em_risco','hibernando','indefinido')),
  ltv_cents     bigint      NOT NULL DEFAULT 0,
  order_count   integer     NOT NULL DEFAULT 0,
  last_order_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, email_hash)
);

CREATE TABLE public.automation_flows (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  trigger     text        NOT NULL,   -- 'carrinho_abandonado' | 'pedido_entregue' | 'reativacao' | 'aniversario'
  channel     text        NOT NULL    CHECK (channel IN ('email','sms','whatsapp')),
  is_active   boolean     NOT NULL DEFAULT true,
  sent_30d    integer     NOT NULL DEFAULT 0,
  recovered   integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_executions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id     uuid        NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  customer_id uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  status      text        NOT NULL CHECK (status IN ('sent','delivered','failed','converted')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  metadata    jsonb       NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_customers_client_id  ON public.customers(client_id);
CREATE INDEX idx_customers_rfm        ON public.customers(rfm_score);
CREATE INDEX idx_automation_client    ON public.automation_flows(client_id);
CREATE INDEX idx_auto_exec_flow       ON public.automation_executions(flow_id);

CREATE TRIGGER set_updated_at_customers
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_automation_flows
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_flows     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers: member or staff"
  ON public.customers FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "customers: system write"
  ON public.customers FOR ALL USING (true);

CREATE POLICY "automation_flows: member or staff"
  ON public.automation_flows FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "automation_flows: member update"
  ON public.automation_flows FOR UPDATE
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "automation_flows: system insert"
  ON public.automation_flows FOR INSERT WITH CHECK (true);

CREATE POLICY "automation_executions: member or staff"
  ON public.automation_executions FOR SELECT
  USING (
    flow_id IN (
      SELECT id FROM public.automation_flows
      WHERE client_id = auth.current_client_id()
    ) OR auth.is_orbia_staff()
  );

CREATE POLICY "automation_executions: system write"
  ON public.automation_executions FOR ALL USING (true);
-- ============================================================
-- 011_billing.sql
-- subscriptions, transactions (ledger imutável), ledger_entries
-- REGRAS:
--   - transactions: NUNCA UPDATE ou DELETE (audit trail imutável)
--   - ledger_entries: NUNCA UPDATE ou DELETE
--   - amount_cents: SEMPRE inteiro em centavos (nunca float)
--   - idempotency_key: previne double-charge
-- ============================================================

CREATE TABLE public.subscriptions (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id          uuid        UNIQUE NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan               text        NOT NULL CHECK (plan IN ('launch','growth','scale')),
  status             text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('trialing','active','past_due','cancelled','paused')),
  amount_cents       bigint      NOT NULL,    -- monthly amount in BRL cents
  provider           text        NOT NULL CHECK (provider IN ('stripe','pagar_me','manual')),
  provider_sub_id    text        UNIQUE,       -- provider subscription ID
  current_period_end timestamptz,
  cancelled_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Imutável: sem UPDATE fora de status, sem DELETE nunca
CREATE TABLE public.transactions (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id        uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type             text        NOT NULL CHECK (type IN ('subscription','addon','refund','chargeback','manual_credit')),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','confirmed','failed','refunded')),
  amount_cents     bigint      NOT NULL,       -- BRL cents, positive = revenue, negative = refund
  currency         text        NOT NULL DEFAULT 'BRL',
  provider         text        NOT NULL CHECK (provider IN ('stripe','pagar_me','manual')),
  provider_tx_id   text        UNIQUE,         -- idempotency via provider's transaction ID
  idempotency_key  text        UNIQUE,         -- client-generated idempotency key
  description      text,
  metadata         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
  -- No DELETE policy. No UPDATE except status transition via controlled function.
);

-- Double-entry ledger: every transaction generates two entries
CREATE TABLE public.ledger_entries (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  account        text        NOT NULL,   -- 'accounts_receivable' | 'revenue' | 'refund_expense' | 'deferred_revenue'
  direction      text        NOT NULL CHECK (direction IN ('debit','credit')),
  amount_cents   bigint      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
  -- Immutable: no UPDATE, no DELETE
);

CREATE INDEX idx_subscriptions_client  ON public.subscriptions(client_id);
CREATE INDEX idx_subscriptions_status  ON public.subscriptions(status);
CREATE INDEX idx_transactions_client   ON public.transactions(client_id);
CREATE INDEX idx_transactions_status   ON public.transactions(status);
CREATE INDEX idx_transactions_type     ON public.transactions(type);
CREATE INDEX idx_transactions_created  ON public.transactions(created_at DESC);
CREATE INDEX idx_ledger_tx             ON public.ledger_entries(transaction_id);

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: member or staff"
  ON public.subscriptions FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

CREATE POLICY "subscriptions: staff write"
  ON public.subscriptions FOR ALL
  USING (auth.is_orbia_staff());

CREATE POLICY "transactions: member or staff"
  ON public.transactions FOR SELECT
  USING (client_id = auth.current_client_id() OR auth.is_orbia_staff());

-- Transactions are written only by service role (system)
CREATE POLICY "transactions: system insert"
  ON public.transactions FOR INSERT WITH CHECK (true);

-- Status-only updates via controlled server functions
CREATE POLICY "transactions: system update"
  ON public.transactions FOR UPDATE USING (true);

-- No DELETE policy for transactions

CREATE POLICY "ledger_entries: member or staff"
  ON public.ledger_entries FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE client_id = auth.current_client_id()
    ) OR auth.is_orbia_staff()
  );

CREATE POLICY "ledger_entries: system insert"
  ON public.ledger_entries FOR INSERT WITH CHECK (true);

-- No UPDATE, no DELETE for ledger_entries

-- ─── MRR view ────────────────────────────────────────────────
CREATE VIEW public.mrr_by_plan AS
  SELECT
    plan,
    COUNT(*)        AS client_count,
    SUM(amount_cents) AS total_mrr_cents
  FROM public.subscriptions
  WHERE status = 'active'
  GROUP BY plan;
