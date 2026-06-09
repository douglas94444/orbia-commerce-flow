-- ============================================================
-- 021_rls_hardening.sql
-- Restrict system-write policies to service_role; lock down RPCs.
-- ============================================================

-- ─── Drop permissive system-write policies ───────────────────

DROP POLICY IF EXISTS "audit_logs: system insert" ON public.audit_logs;
DROP POLICY IF EXISTS "integration_logs: system insert" ON public.integration_logs;
DROP POLICY IF EXISTS "job_logs: system insert" ON public.job_logs;
DROP POLICY IF EXISTS "job_logs: system update" ON public.job_logs;
DROP POLICY IF EXISTS "webhook_events: system insert" ON public.webhook_events;
DROP POLICY IF EXISTS "webhook_events: system update" ON public.webhook_events;
DROP POLICY IF EXISTS "orders: system insert" ON public.orders;
DROP POLICY IF EXISTS "orders: system update" ON public.orders;
DROP POLICY IF EXISTS "order_events: system insert" ON public.order_events;
DROP POLICY IF EXISTS "inventory: system write" ON public.inventory;
DROP POLICY IF EXISTS "ad_accounts: system write" ON public.ad_accounts;
DROP POLICY IF EXISTS "campaigns: system write" ON public.campaigns;
DROP POLICY IF EXISTS "nfe_emissions: system write" ON public.nfe_emissions;
DROP POLICY IF EXISTS "fiscal_configs: system write" ON public.fiscal_configs;
DROP POLICY IF EXISTS "customers: system write" ON public.customers;
DROP POLICY IF EXISTS "automation_flows: system insert" ON public.automation_flows;
DROP POLICY IF EXISTS "automation_executions: system write" ON public.automation_executions;
DROP POLICY IF EXISTS "transactions: system insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions: system update" ON public.transactions;
DROP POLICY IF EXISTS "ledger_entries: system insert" ON public.ledger_entries;

-- ─── Recreate — service_role only ────────────────────────────

CREATE POLICY "audit_logs: service insert"
  ON public.audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "integration_logs: service insert"
  ON public.integration_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "job_logs: service insert"
  ON public.job_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "job_logs: service update"
  ON public.job_logs FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "webhook_events: service insert"
  ON public.webhook_events FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "webhook_events: service update"
  ON public.webhook_events FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "orders: service insert"
  ON public.orders FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "orders: service update"
  ON public.orders FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "order_events: service insert"
  ON public.order_events FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "inventory: service write"
  ON public.inventory FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "ad_accounts: service write"
  ON public.ad_accounts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "campaigns: service write"
  ON public.campaigns FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "nfe_emissions: service write"
  ON public.nfe_emissions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "fiscal_configs: service write"
  ON public.fiscal_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "customers: service write"
  ON public.customers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "automation_flows: service insert"
  ON public.automation_flows FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "automation_executions: service write"
  ON public.automation_executions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "transactions: service insert"
  ON public.transactions FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "transactions: service update"
  ON public.transactions FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "ledger_entries: service insert"
  ON public.ledger_entries FOR INSERT TO service_role
  WITH CHECK (true);

-- ─── Revoke direct writes from client roles ──────────────────

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.integration_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.job_logs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.webhook_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ad_accounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.campaigns FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.nfe_emissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fiscal_configs FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.customers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.automation_flows FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.automation_executions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ledger_entries FROM anon, authenticated;

-- ─── RPC hardening ───────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.refresh_client_last_contact(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_client_last_contact(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_oauth_states() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_oauth_states() TO service_role;
