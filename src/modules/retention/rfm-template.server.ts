import type { TemplateContext } from "./template-engine.server";

type RfmSegment = "campeoes" | "leais" | "promissores" | "em_risco" | "hibernando" | "perdidos";

const RFM_EMAIL_BODIES: Record<RfmSegment, string> = {
  campeoes:
    "<p>Olá {{nome}},</p><p>Como cliente VIP da {{loja}}, preparamos {{cupom}} com desconto exclusivo para você.</p>",
  leais:
    "<p>Olá {{nome}},</p><p>Obrigado por ser fiel à {{loja}}! Use {{cupom}} na sua próxima compra.</p>",
  promissores:
    "<p>Olá {{nome}},</p><p>Você está evoluindo conosco — aproveite {{cupom}} para continuar sua jornada na {{loja}}.</p>",
  em_risco:
    "<p>Olá {{nome}},</p><p>Sentimos sua falta! Volte para a {{loja}} com {{cupom}} antes que expire.</p>",
  hibernando:
    "<p>Olá {{nome}},</p><p>Faz tempo que não nos vemos. {{cupom}} espera por você na {{loja}}.</p>",
  perdidos:
    "<p>Olá {{nome}},</p><p>Última chance: {{cupom}} para retornar à {{loja}} com condição especial.</p>",
};

const RFM_SMS_BODIES: Record<RfmSegment, string> = {
  campeoes: "{{loja}}: {{nome}}, seu cupom VIP {{cupom}} está ativo!",
  leais: "{{loja}}: Obrigado pela fidelidade, {{nome}}! Cupom: {{cupom}}",
  promissores: "{{loja}}: {{nome}}, continue evoluindo — cupom {{cupom}}",
  em_risco: "{{loja}}: {{nome}}, sentimos sua falta! Cupom {{cupom}}",
  hibernando: "{{loja}}: {{nome}}, volte com {{cupom}}",
  perdidos: "{{loja}}: {{nome}}, última chance com {{cupom}}",
};

const RFM_WA_BODIES: Record<RfmSegment, string> = {
  campeoes: "Olá {{nome}}! Como VIP da {{loja}}, seu cupom {{cupom}} está pronto.",
  leais: "Oi {{nome}}! Obrigado por ser cliente fiel. Cupom: {{cupom}}",
  promissores: "{{nome}}, você está evoluindo! Cupom {{cupom}} na {{loja}}.",
  em_risco: "{{nome}}, sentimos sua falta na {{loja}}. Cupom: {{cupom}}",
  hibernando: "{{nome}}, faz tempo! Volte com {{cupom}} na {{loja}}.",
  perdidos: "{{nome}}, última chance na {{loja}} com {{cupom}}.",
};

function normalizeSegment(segment: string | undefined): RfmSegment | null {
  const s = segment?.toLowerCase();
  if (s && s in RFM_EMAIL_BODIES) return s as RfmSegment;
  return null;
}

export function pickRfmEmailBody(
  templateKey: string,
  segment: string | undefined,
  defaultBody: string,
): string {
  if (templateKey !== "reativacao") return defaultBody;
  const rfm = normalizeSegment(segment);
  return rfm ? RFM_EMAIL_BODIES[rfm] : defaultBody;
}

export function pickRfmSmsBody(
  templateKey: string,
  segment: string | undefined,
  defaultBody: string,
): string {
  if (templateKey !== "reativacao") return defaultBody;
  const rfm = normalizeSegment(segment);
  return rfm ? RFM_SMS_BODIES[rfm] : defaultBody;
}

export function pickRfmWaBody(
  templateKey: string,
  segment: string | undefined,
  defaultBody: string,
): string {
  if (templateKey !== "reativacao") return defaultBody;
  const rfm = normalizeSegment(segment);
  return rfm ? RFM_WA_BODIES[rfm] : defaultBody;
}

export function enrichTemplateContextWithRfm(
  ctx: TemplateContext,
  segment: string | undefined,
): TemplateContext {
  if (!segment) return ctx;
  return { ...ctx, rfm_segment: segment };
}
