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
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

-- Token writes go through server functions only (service role or staff-scoped client).
CREATE POLICY "oauth_connections: staff write"
  ON public.oauth_connections FOR INSERT
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "oauth_connections: staff update"
  ON public.oauth_connections FOR UPDATE
  USING (public.is_orbia_staff());

-- Clients can revoke their own connections; staff can revoke any.
CREATE POLICY "oauth_connections: member or staff delete"
  ON public.oauth_connections FOR DELETE
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

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
