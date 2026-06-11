/** Semantic design tokens — LTV Boost layer adapted for Orbia (Tailwind v4 + oklch). */

export type RfmSegmentKey =
  | "campeoes"
  | "leais"
  | "potencial"
  | "novos"
  | "em_risco"
  | "hibernando"
  | "perdidos";

export type SeverityLevel = "critico" | "alto" | "medio";

export type MessageChannel = "whatsapp" | "email" | "sms" | "push" | "multicanal";

export const RFM_SEGMENT_LABELS: Record<RfmSegmentKey, string> = {
  campeoes: "Campeões",
  leais: "Leais",
  potencial: "Potencial",
  novos: "Novos",
  em_risco: "Em risco",
  hibernando: "Hibernando",
  perdidos: "Perdidos",
};

/** Tailwind classes — always semantic, never raw hex in components. */
export const RFM_SEGMENT_STYLES: Record<RfmSegmentKey, string> = {
  campeoes: "border-primary/25 bg-primary/10 text-primary",
  leais: "border-info/25 bg-info/10 text-info",
  potencial: "border-rfm-potential/25 bg-rfm-potential/10 text-rfm-potential",
  novos: "border-success/25 bg-success/10 text-success",
  em_risco: "border-warning/25 bg-warning/10 text-warning",
  hibernando: "border-border bg-muted/50 text-muted-foreground",
  perdidos: "border-destructive/25 bg-destructive/10 text-destructive",
};

export const SEVERITY_STYLES: Record<
  SeverityLevel,
  { label: string; className: string; pulse?: boolean }
> = {
  critico: {
    label: "Crítico",
    className: "border-severity-critical/25 bg-severity-critical/10 text-severity-critical",
    pulse: true,
  },
  alto: {
    label: "Alto",
    className: "border-severity-high/25 bg-severity-high/10 text-severity-high",
  },
  medio: {
    label: "Médio",
    className: "border-severity-medium/25 bg-severity-medium/10 text-severity-medium",
  },
};

export const CHANNEL_LABELS: Record<Exclude<MessageChannel, "multicanal">, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  sms: "SMS",
  push: "Push",
};

/** CSS variable names for icon color (use with style={{ color: 'var(--channel-whatsapp)' }}) */
export const CHANNEL_CSS_VAR: Record<Exclude<MessageChannel, "multicanal">, string> = {
  whatsapp: "var(--channel-whatsapp)",
  email: "var(--channel-email)",
  sms: "var(--channel-sms)",
  push: "var(--channel-push)",
};

export function normalizeRfmSegment(segment: string): RfmSegmentKey {
  const aliases: Record<string, RfmSegmentKey> = {
    campeoes: "campeoes",
    campiao: "campeoes",
    campeões: "campeoes",
    leais: "leais",
    fiel: "leais",
    fieis: "leais",
    fiéis: "leais",
    potencial: "potencial",
    potenciais: "potencial",
    novos: "novos",
    novo: "novos",
    em_risco: "em_risco",
    hibernando: "hibernando",
    perdidos: "perdidos",
    indefinido: "perdidos",
  };
  return aliases[segment.toLowerCase()] ?? "perdidos";
}

export function normalizeChannel(channel: string): MessageChannel {
  const key = channel.toLowerCase();
  if (key.includes("whatsapp")) return "whatsapp";
  if (key.includes("email") || key.includes("e-mail")) return "email";
  if (key.includes("sms")) return "sms";
  if (key.includes("push")) return "push";
  if (key.includes("multi")) return "multicanal";
  return "email";
}
