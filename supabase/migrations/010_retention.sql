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
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "customers: system write"
  ON public.customers FOR ALL USING (true);

CREATE POLICY "automation_flows: member or staff"
  ON public.automation_flows FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "automation_flows: member update"
  ON public.automation_flows FOR UPDATE
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "automation_flows: system insert"
  ON public.automation_flows FOR INSERT WITH CHECK (true);

CREATE POLICY "automation_executions: member or staff"
  ON public.automation_executions FOR SELECT
  USING (
    flow_id IN (
      SELECT id FROM public.automation_flows
      WHERE client_id = public.current_client_id()
    ) OR public.is_orbia_staff()
  );

CREATE POLICY "automation_executions: system write"
  ON public.automation_executions FOR ALL USING (true);
