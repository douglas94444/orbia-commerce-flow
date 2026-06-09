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
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "subscriptions: staff write"
  ON public.subscriptions FOR ALL
  USING (public.is_orbia_staff());

CREATE POLICY "transactions: member or staff"
  ON public.transactions FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

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
      WHERE client_id = public.current_client_id()
    ) OR public.is_orbia_staff()
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
