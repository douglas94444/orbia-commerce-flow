-- ============================================================
-- 062_sac_kb_reclame_metrics.sql — KB, Reclame Aqui, métricas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sac_knowledge_articles (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  slug        text        NOT NULL,
  title       text        NOT NULL,
  body        text        NOT NULL,
  category    text        NOT NULL DEFAULT 'geral',
  is_public   boolean     NOT NULL DEFAULT false,
  bot_enabled boolean     NOT NULL DEFAULT true,
  view_count  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, slug)
);

CREATE TABLE IF NOT EXISTS public.sac_reclame_aqui_cases (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ticket_id           uuid        REFERENCES public.sac_tickets(id) ON DELETE SET NULL,
  external_id         text        NOT NULL,
  cnpj                text        NOT NULL,
  status              text        NOT NULL DEFAULT 'open',
  complaint_text      text,
  score_impact        numeric(4,2),
  suggested_response  text,
  published_response  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_id)
);

CREATE TABLE IF NOT EXISTS public.sac_sentiment_scores (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id     uuid        NOT NULL REFERENCES public.sac_tickets(id) ON DELETE CASCADE,
  sentiment     text        NOT NULL CHECK (sentiment IN ('positive','neutral','negative')),
  confidence    numeric(4,3) NOT NULL DEFAULT 0,
  analyzed_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sac_kb_client ON public.sac_knowledge_articles(client_id, category);
CREATE INDEX IF NOT EXISTS idx_sac_kb_slug ON public.sac_knowledge_articles(client_id, slug);
CREATE INDEX IF NOT EXISTS idx_sac_reclame_client ON public.sac_reclame_aqui_cases(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sac_sentiment_ticket ON public.sac_sentiment_scores(ticket_id);

CREATE TRIGGER sac_knowledge_articles_updated_at
  BEFORE UPDATE ON public.sac_knowledge_articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sac_reclame_aqui_cases_updated_at
  BEFORE UPDATE ON public.sac_reclame_aqui_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sac_knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_reclame_aqui_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_sentiment_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sac_kb: member"
  ON public.sac_knowledge_articles FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sac_reclame: member"
  ON public.sac_reclame_aqui_cases FOR ALL
  USING (client_id = public.current_client_id() OR public.is_orbia_staff())
  WITH CHECK (client_id = public.current_client_id() OR public.is_orbia_staff());

CREATE POLICY "sac_sentiment: member read"
  ON public.sac_sentiment_scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM sac_tickets t WHERE t.id = ticket_id
    AND (t.client_id = public.current_client_id() OR public.is_orbia_staff())));

CREATE OR REPLACE VIEW public.sac_metrics_daily AS
SELECT
  t.client_id,
  DATE(t.created_at) AS day,
  t.channel,
  t.category,
  COUNT(*) AS ticket_count,
  COUNT(*) FILTER (WHERE t.status IN ('resolved','closed')) AS resolved_count,
  COUNT(*) FILTER (WHERE t.first_response_at IS NOT NULL
    AND t.first_response_at <= t.sla_response_due_at) AS sla_met_count,
  AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60)
    FILTER (WHERE t.first_response_at IS NOT NULL) AS avg_tmr_minutes,
  AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60)
    FILTER (WHERE t.resolved_at IS NOT NULL) AS avg_tma_minutes
FROM public.sac_tickets t
GROUP BY t.client_id, DATE(t.created_at), t.channel, t.category;
