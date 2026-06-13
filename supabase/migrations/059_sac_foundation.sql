-- ============================================================
-- 059_sac_foundation.sql — SAC inbox, tickets, messages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sac_sla_policies (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel             text        NOT NULL,
  category            text,
  response_minutes    integer     NOT NULL DEFAULT 120,
  resolution_minutes  integer     NOT NULL DEFAULT 2880,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, channel, category)
);

CREATE TABLE IF NOT EXISTS public.sac_tickets (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol                text        NOT NULL UNIQUE,
  client_id               uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id             uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id                uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  channel                 text        NOT NULL CHECK (channel IN (
    'whatsapp','email','chat','instagram','mercado_livre','shopee','amazon','site_form'
  )),
  category                text        NOT NULL DEFAULT 'duvida',
  subcategory             text,
  priority                text        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent','critical')),
  status                  text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting_customer','resolved','closed','merged')),
  assigned_to             uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_external_id      text,
  subject                 text,
  first_response_at       timestamptz,
  resolved_at             timestamptz,
  sla_response_due_at     timestamptz,
  sla_resolution_due_at   timestamptz,
  tags                    jsonb       NOT NULL DEFAULT '[]',
  metadata                jsonb       NOT NULL DEFAULT '{}',
  merged_into_ticket_id   uuid        REFERENCES public.sac_tickets(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sac_conversations (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id           uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel             text        NOT NULL,
  external_thread_id  text,
  customer_phone      text,
  customer_email      text,
  unread_count        integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sac_messages (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   uuid        NOT NULL REFERENCES public.sac_conversations(id) ON DELETE CASCADE,
  ticket_id         uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  direction         text        NOT NULL CHECK (direction IN ('inbound','outbound','system','bot')),
  body              text        NOT NULL,
  attachments       jsonb       NOT NULL DEFAULT '[]',
  sender_type       text        NOT NULL CHECK (sender_type IN ('customer','agent','bot','system')),
  staff_id          uuid        REFERENCES public.profiles(id),
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sac_ticket_events (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id   uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  staff_id    uuid        REFERENCES public.profiles(id),
  event_type  text        NOT NULL CHECK (event_type IN (
    'created','assigned','status_change','priority_change','merged','split','escalated','note','resolved'
  )),
  old_value   text,
  new_value   text,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sac_agent_capacity (
  id                      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id               uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  staff_id                uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_concurrent_tickets  smallint    NOT NULL DEFAULT 10,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_sac_tickets_client_status ON public.sac_tickets(client_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_sac_tickets_assigned ON public.sac_tickets(assigned_to) WHERE status NOT IN ('closed','merged','resolved');
CREATE INDEX IF NOT EXISTS idx_sac_tickets_protocol ON public.sac_tickets(protocol);
CREATE INDEX IF NOT EXISTS idx_sac_tickets_customer ON public.sac_tickets(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sac_tickets_sla ON public.sac_tickets(sla_response_due_at) WHERE first_response_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sac_conversations_ticket ON public.sac_conversations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_sac_messages_conversation ON public.sac_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sac_messages_ticket ON public.sac_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sac_ticket_events_ticket ON public.sac_ticket_events(ticket_id, created_at DESC);

CREATE TRIGGER sac_sla_policies_updated_at
  BEFORE UPDATE ON public.sac_sla_policies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sac_tickets_updated_at
  BEFORE UPDATE ON public.sac_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sac_conversations_updated_at
  BEFORE UPDATE ON public.sac_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sac_agent_capacity_updated_at
  BEFORE UPDATE ON public.sac_agent_capacity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sac_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_agent_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sac_tickets: member read"
  ON public.sac_tickets FOR SELECT
  USING (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sac_tickets: member write"
  ON public.sac_tickets FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sac_conversations: member"
  ON public.sac_conversations FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sac_messages: member"
  ON public.sac_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sac_tickets t
    WHERE t.id = ticket_id AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sac_tickets t
    WHERE t.id = ticket_id AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())
  ));

CREATE POLICY "sac_ticket_events: member read"
  ON public.sac_ticket_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sac_tickets t
    WHERE t.id = ticket_id AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())
  ));

CREATE POLICY "sac_ticket_events: member insert"
  ON public.sac_ticket_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sac_tickets t
    WHERE t.id = ticket_id AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())
  ));

CREATE POLICY "sac_sla_policies: member"
  ON public.sac_sla_policies FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sac_agent_capacity: member"
  ON public.sac_agent_capacity FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

-- Default SLA policies seed function
CREATE OR REPLACE FUNCTION public.seed_sac_sla_defaults(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO sac_sla_policies (client_id, channel, category, response_minutes, resolution_minutes) VALUES
    (p_client_id, 'whatsapp', NULL, 120, 2880),
    (p_client_id, 'email', NULL, 1440, 4320),
    (p_client_id, 'mercado_livre', NULL, 720, 2880),
    (p_client_id, 'shopee', NULL, 720, 2880),
    (p_client_id, 'amazon', NULL, 720, 2880),
    (p_client_id, 'site_form', NULL, 480, 2880)
  ON CONFLICT (client_id, channel, category) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_sac_unread(conv_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE sac_conversations
  SET unread_count = unread_count + 1, updated_at = now()
  WHERE id = conv_id;
END;
$$;
