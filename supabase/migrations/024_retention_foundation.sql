-- ============================================================
-- 024_retention_foundation.sql
-- LTV Boost Fase 1: sequences, steps, enrollments, delivery log
-- ============================================================

-- Unify RFM segments on customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS acquisition_channel text,
  ADD COLUMN IF NOT EXISTS cold_list_at timestamptz;

UPDATE public.customers
SET rfm_segment = CASE rfm_score
  WHEN 'campiao' THEN 'campeoes'
  WHEN 'fiel' THEN 'leais'
  WHEN 'em_risco' THEN 'em_risco'
  WHEN 'hibernando' THEN 'hibernando'
  ELSE COALESCE(rfm_segment, 'perdidos')
END
WHERE rfm_segment IS NULL;

-- ─── Automation sequences (multi-step flows) ────────────────

CREATE TABLE IF NOT EXISTS public.automation_sequences (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  trigger           text        NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  status            text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','paused')),
  quiet_hours_start smallint    NOT NULL DEFAULT 22,
  quiet_hours_end   smallint    NOT NULL DEFAULT 8,
  sent_30d          integer     NOT NULL DEFAULT 0,
  recovered_cents   bigint      NOT NULL DEFAULT 0,
  metadata          jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_steps (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id     uuid        NOT NULL REFERENCES public.automation_sequences(id) ON DELETE CASCADE,
  channel         text        NOT NULL CHECK (channel IN ('email','sms','whatsapp','push')),
  delay_minutes   integer     NOT NULL DEFAULT 0,
  condition_type  text,
  template_key    text        NOT NULL DEFAULT 'default',
  sort_order      integer     NOT NULL DEFAULT 0,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_enrollments (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id         uuid        NOT NULL REFERENCES public.automation_sequences(id) ON DELETE CASCADE,
  customer_id         uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  current_step_index  integer     NOT NULL DEFAULT 0,
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active','paused','completed','cancelled')),
  next_run_at         timestamptz NOT NULL DEFAULT now(),
  context             jsonb       NOT NULL DEFAULT '{}',
  enrolled_at         timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_contact_prefs (
  customer_id                 uuid        PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  opted_out_channels          text[]      NOT NULL DEFAULT '{}',
  whatsapp_window_expires_at  timestamptz,
  birthday                    date,
  first_purchase_at           timestamptz,
  push_tokens                 jsonb       NOT NULL DEFAULT '[]',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_delivery_log (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id        uuid        REFERENCES public.automation_executions(id) ON DELETE SET NULL,
  enrollment_id       uuid        REFERENCES public.automation_enrollments(id) ON DELETE SET NULL,
  channel             text        NOT NULL,
  provider_message_id text,
  status              text        NOT NULL DEFAULT 'sent'
                                  CHECK (status IN ('sent','delivered','opened','clicked','failed')),
  opened_at           timestamptz,
  clicked_at          timestamptz,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  metadata            jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.automation_executions
  ALTER COLUMN flow_id DROP NOT NULL;

ALTER TABLE public.automation_executions
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES public.automation_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step_id uuid REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_id uuid REFERENCES public.automation_sequences(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.increment_sequence_recovered(p_sequence_id uuid, p_cents bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.automation_sequences
  SET recovered_cents = recovered_cents + p_cents, updated_at = now()
  WHERE id = p_sequence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_sequence_recovered(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_sequence_recovered(uuid, bigint) TO service_role;

ALTER TABLE public.automation_flows
  ADD COLUMN IF NOT EXISTS sequence_id uuid REFERENCES public.automation_sequences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sequences_client ON public.automation_sequences(client_id);
CREATE INDEX IF NOT EXISTS idx_sequences_trigger ON public.automation_sequences(trigger, is_active);
CREATE INDEX IF NOT EXISTS idx_steps_sequence ON public.automation_steps(sequence_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_enrollments_next ON public.automation_enrollments(status, next_run_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_enrollments_customer ON public.automation_enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_execution ON public.message_delivery_log(execution_id);
CREATE INDEX IF NOT EXISTS idx_delivery_log_provider ON public.message_delivery_log(provider_message_id);

CREATE TRIGGER set_updated_at_automation_sequences
  BEFORE UPDATE ON public.automation_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_automation_enrollments
  BEFORE UPDATE ON public.automation_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_customer_contact_prefs
  BEFORE UPDATE ON public.customer_contact_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.automation_sequences      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_enrollments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contact_prefs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_delivery_log      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sequences: member or staff"
  ON public.automation_sequences FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sequences: member update"
  ON public.automation_sequences FOR UPDATE
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sequences: system write"
  ON public.automation_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "steps: via sequence"
  ON public.automation_steps FOR SELECT
  USING (
    sequence_id IN (
      SELECT id FROM public.automation_sequences
      WHERE client_id = public.current_client_id()
    ) OR public.is_orbia_staff()
  );

CREATE POLICY "steps: system write"
  ON public.automation_steps FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "enrollments: member or staff"
  ON public.automation_enrollments FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "enrollments: system write"
  ON public.automation_enrollments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "contact_prefs: member or staff"
  ON public.customer_contact_prefs FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE client_id = public.current_client_id()
    ) OR public.is_orbia_staff()
  );

CREATE POLICY "contact_prefs: system write"
  ON public.customer_contact_prefs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "delivery_log: member or staff"
  ON public.message_delivery_log FOR SELECT
  USING (
    execution_id IN (
      SELECT ae.id FROM public.automation_executions ae
      JOIN public.automation_flows af ON af.id = ae.flow_id
      WHERE af.client_id = public.current_client_id()
    )
    OR enrollment_id IN (
      SELECT id FROM public.automation_enrollments
      WHERE client_id = public.current_client_id()
    )
    OR public.is_orbia_staff()
  );

CREATE POLICY "delivery_log: system write"
  ON public.message_delivery_log FOR ALL TO service_role USING (true) WITH CHECK (true);
