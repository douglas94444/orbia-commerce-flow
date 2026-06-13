-- ============================================================
-- 060_sac_chatbot_agent.sql — Chatbot, quick replies, CSAT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sac_quick_replies (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  body        text        NOT NULL,
  category    text,
  sort_order  smallint    NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sac_bot_sessions (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id     uuid        NOT NULL REFERENCES public.sac_conversations(id) ON DELETE CASCADE,
  ticket_id           uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  step                text        NOT NULL DEFAULT 'greeting',
  context             jsonb       NOT NULL DEFAULT '{}',
  handoff_requested   boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

CREATE TABLE IF NOT EXISTS public.sac_internal_notes (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id   uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  staff_id    uuid        NOT NULL REFERENCES public.profiles(id),
  body        text        NOT NULL,
  mentions    jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sac_csat_surveys (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id     uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  client_id     uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel       text        NOT NULL,
  score         smallint    CHECK (score IS NULL OR (score BETWEEN 1 AND 5)),
  comment       text,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sac_quick_replies_client ON public.sac_quick_replies(client_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sac_internal_notes_ticket ON public.sac_internal_notes(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sac_csat_ticket ON public.sac_csat_surveys(ticket_id);

CREATE TRIGGER sac_quick_replies_updated_at
  BEFORE UPDATE ON public.sac_quick_replies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sac_bot_sessions_updated_at
  BEFORE UPDATE ON public.sac_bot_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sac_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_csat_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sac_quick_replies: member"
  ON public.sac_quick_replies FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sac_bot_sessions: member"
  ON public.sac_bot_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM sac_tickets t JOIN sac_conversations c ON c.ticket_id = t.id
    WHERE c.id = conversation_id AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())))
  WITH CHECK (true);

CREATE POLICY "sac_internal_notes: member"
  ON public.sac_internal_notes FOR ALL
  USING (EXISTS (SELECT 1 FROM sac_tickets t WHERE t.id = ticket_id
    AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())))
  WITH CHECK (EXISTS (SELECT 1 FROM sac_tickets t WHERE t.id = ticket_id
    AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())));

CREATE POLICY "sac_csat: member"
  ON public.sac_csat_surveys FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());
