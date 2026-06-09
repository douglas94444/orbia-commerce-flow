-- ============================================================
-- 016_health_alerts.sql
-- Operational alerts for health score engine (Fase 2A)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operation_alerts (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        REFERENCES public.clients(id) ON DELETE CASCADE,
  kind        text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  title       text        NOT NULL,
  message     text        NOT NULL,
  is_resolved boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_client ON public.operation_alerts(client_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.operation_alerts(created_at DESC);

ALTER TABLE public.operation_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operation_alerts: staff or member client"
  ON public.operation_alerts FOR SELECT
  USING (
    public.is_orbia_staff()
    OR client_id = public.current_client_id()
  );

CREATE POLICY "operation_alerts: staff write"
  ON public.operation_alerts FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());
