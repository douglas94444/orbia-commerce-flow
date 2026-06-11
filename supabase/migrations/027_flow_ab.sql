-- ============================================================
-- 027_flow_ab.sql
-- LTV Boost Fase 4: editor visual, A/B, biblioteca de templates
-- ============================================================

ALTER TABLE public.automation_sequences
  ADD COLUMN IF NOT EXISTS flow_definition jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.ab_experiments (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id         uuid        NOT NULL REFERENCES public.automation_steps(id) ON DELETE CASCADE,
  variant_a_key   text        NOT NULL,
  variant_b_key   text        NOT NULL,
  traffic_split   smallint    NOT NULL DEFAULT 50,
  winner          text        CHECK (winner IN ('a','b')),
  conversions_a   integer     NOT NULL DEFAULT 0,
  conversions_b   integer     NOT NULL DEFAULT 0,
  sends_a         integer     NOT NULL DEFAULT 0,
  sends_b         integer     NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_template_library (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  vertical      text        NOT NULL,
  trigger       text        NOT NULL,
  channel       text        NOT NULL,
  name          text        NOT NULL,
  template_key  text        NOT NULL,
  subject       text,
  body_preview  text        NOT NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_step ON public.ab_experiments(step_id);
CREATE INDEX IF NOT EXISTS idx_template_lib_vertical ON public.automation_template_library(vertical, trigger);

CREATE TRIGGER set_updated_at_ab_experiments
  BEFORE UPDATE ON public.ab_experiments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ab_experiments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_template_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ab_experiments: member via step"
  ON public.ab_experiments FOR SELECT
  USING (
    step_id IN (
      SELECT s.id FROM public.automation_steps s
      JOIN public.automation_sequences seq ON seq.id = s.sequence_id
      WHERE seq.client_id = public.current_client_id()
    ) OR public.is_orbia_staff()
  );

CREATE POLICY "ab_experiments: system write"
  ON public.ab_experiments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "template_library: read all authenticated"
  ON public.automation_template_library FOR SELECT
  USING (true);

CREATE POLICY "template_library: staff write"
  ON public.automation_template_library FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed template library by vertical
INSERT INTO public.automation_template_library (vertical, trigger, channel, name, template_key, subject, body_preview, metadata) VALUES
  ('moda', 'carrinho_abandonado', 'email', 'Carrinho moda D+1', 'carrinho_moda_email', 'Você esqueceu algo no carrinho', 'Oi {{nome}}, seus itens de moda estão te esperando. Finalize em {{checkout_url}}', '{"discount_pct":5}'),
  ('moda', 'carrinho_abandonado', 'whatsapp', 'Carrinho moda WA', 'carrinho_moda_wa', NULL, 'Oi {{nome}}! Seu look favorito ainda está no carrinho 👗', '{}'),
  ('beleza', 'pedido_entregue', 'whatsapp', 'Pós-entrega beleza', 'pos_entrega_beleza', NULL, 'Oi {{nome}}, seu pedido de beleza chegou! Avalie sua experiência.', '{}'),
  ('suplementos', 'reativacao', 'email', 'Reativação suplementos', 'reativacao_supp', 'Sentimos sua falta', 'Oi {{nome}}, volte com 10% OFF em suplementos.', '{"discount_pct":10}'),
  ('eletronicos', 'pedido_entregue', 'whatsapp', 'Rastreio eletrônicos', 'rastreio_eletronicos', NULL, 'Seu pedido {{produto}} foi despachado. Rastreie: {{rastreio}}', '{}')
;
