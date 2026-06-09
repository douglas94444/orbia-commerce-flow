-- ============================================================
-- 020_cs_admin.sql
-- Customer Success activities, onboarding tasks (Fase 3)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cs_activities (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  staff_id    uuid        NOT NULL REFERENCES public.profiles(id),
  kind        text        NOT NULL CHECK (kind IN ('contact','qbr','nps','onboarding_note')),
  channel     text,
  score       smallint    CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  notes       text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  week         smallint    NOT NULL CHECK (week BETWEEN 1 AND 4),
  task_key     text        NOT NULL,
  title        text        NOT NULL,
  is_done      boolean     NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, week, task_key)
);

CREATE INDEX IF NOT EXISTS idx_cs_activities_client ON public.cs_activities(client_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_client ON public.onboarding_tasks(client_id, week);

ALTER TABLE public.cs_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_activities: member or staff"
  ON public.cs_activities FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "cs_activities: staff write"
  ON public.cs_activities FOR INSERT
  WITH CHECK (public.is_orbia_staff());

CREATE POLICY "onboarding_tasks: member or staff"
  ON public.onboarding_tasks FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "onboarding_tasks: staff write"
  ON public.onboarding_tasks FOR ALL
  USING (public.is_orbia_staff())
  WITH CHECK (public.is_orbia_staff());

CREATE OR REPLACE FUNCTION public.refresh_client_last_contact(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
  v_days smallint;
BEGIN
  SELECT MAX(occurred_at) INTO v_last
  FROM public.cs_activities
  WHERE client_id = p_client_id
    AND kind IN ('contact', 'qbr');

  IF v_last IS NULL THEN
    v_days := 0;
  ELSE
    v_days := GREATEST(0, EXTRACT(DAY FROM (now() - v_last))::smallint);
  END IF;

  UPDATE public.clients
  SET last_contact_days = v_days, updated_at = now()
  WHERE id = p_client_id;
END;
$$;
