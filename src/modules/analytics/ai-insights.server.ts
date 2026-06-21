import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/integrations/claude/client.server";

export interface AiInsight {
  category: "roas" | "retention" | "stock" | "fiscal" | "general";
  headline: string;
  body: string;
  priority: "high" | "medium" | "low";
}

const SYSTEM_PROMPT = `Você é um analista especialista em e-commerce brasileiro.
Analise os dados fornecidos e gere insights acionáveis e concisos em português.
Responda APENAS com um array JSON válido, sem markdown, sem explicações adicionais.
Formato: [{"category":"roas|retention|stock|fiscal|general","headline":"título curto","body":"1-2 frases acionáveis","priority":"high|medium|low"}]
Máximo 4 insights. Foque no que é urgente ou de maior impacto financeiro.`;

interface ClientSnapshot {
  name: string;
  healthScore: number;
  roasAvg: number;
  gmv30d: number;
  sla30d: number;
  criticalAlerts: number;
  rfmSegments: Record<string, number>;
}

async function buildClientSnapshot(clientId: string): Promise<ClientSnapshot | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [clientRes, ordersRes, alertsRes, rfmRes] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("name, health_score, roas_avg")
      .eq("id", clientId)
      .single(),
    supabaseAdmin
      .from("orders")
      .select("status, value_cents")
      .eq("client_id", clientId)
      .gte("created_at", thirtyDaysAgo),
    supabaseAdmin
      .from("operation_alerts")
      .select("id")
      .eq("client_id", clientId)
      .eq("is_resolved", false)
      .eq("severity", "critical"),
    supabaseAdmin
      .from("customers")
      .select("rfm_segment")
      .eq("client_id", clientId)
      .not("rfm_segment", "is", null),
  ]);

  const client = clientRes.data;
  if (!client) return null;

  const orders = ordersRes.data ?? [];
  const gmv30d = orders.reduce((s, o) => s + (o.value_cents ?? 0), 0) / 100;
  const delivered = orders.filter((o) => o.status === "entregue").length;
  const sla30d = orders.length > 0 ? (delivered / orders.length) * 100 : 0;

  const rfmSegments: Record<string, number> = {};
  for (const c of rfmRes.data ?? []) {
    const seg = String(c.rfm_segment ?? "indefinido");
    rfmSegments[seg] = (rfmSegments[seg] ?? 0) + 1;
  }

  return {
    name: client.name,
    healthScore: client.health_score ?? 0,
    roasAvg: Number(client.roas_avg ?? 0),
    gmv30d,
    sla30d,
    criticalAlerts: alertsRes.data?.length ?? 0,
    rfmSegments,
  };
}

export async function generateClientInsights(clientId: string): Promise<AiInsight[]> {
  const snapshot = await buildClientSnapshot(clientId);
  if (!snapshot) return [];

  const prompt = `Dados do cliente "${snapshot.name}":
- Health Score: ${snapshot.healthScore}/100
- ROAS médio: ${snapshot.roasAvg.toFixed(1)}x
- GMV 30 dias: R$${snapshot.gmv30d.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
- SLA logístico: ${snapshot.sla30d.toFixed(0)}% pedidos entregues
- Alertas críticos ativos: ${snapshot.criticalAlerts}
- Segmentos RFM: ${JSON.stringify(snapshot.rfmSegments)}

Gere insights acionáveis para melhorar os resultados deste cliente.`;

  try {
    const raw = await callClaude(prompt, SYSTEM_PROMPT);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as AiInsight[];
  } catch (err) {
    console.error("[ai-insights] Claude error:", err);
    return [];
  }
}

export async function generatePortfolioInsights(): Promise<AiInsight[]> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id, name, health_score, roas_avg")
    .eq("status", "active")
    .order("health_score", { ascending: true })
    .limit(20);

  if (!clients?.length) return [];

  const atRisk = clients.filter((c) => (c.health_score ?? 0) < 50).length;
  const avgRoas =
    clients.reduce((s, c) => s + Number(c.roas_avg ?? 0), 0) / clients.length;
  const belowRoas3x = clients.filter((c) => Number(c.roas_avg ?? 0) < 3).length;

  const prompt = `Dados do portfólio (${clients.length} clientes ativos):
- Clientes com health score crítico (<50): ${atRisk}
- ROAS médio do portfólio: ${avgRoas.toFixed(1)}x
- Clientes com ROAS abaixo de 3x: ${belowRoas3x}
- Clientes mais críticos: ${clients.slice(0, 3).map((c) => `${c.name} (score: ${c.health_score}, ROAS: ${c.roas_avg}x)`).join("; ")}

Gere insights estratégicos para priorização da equipe de CS.`;

  try {
    const raw = await callClaude(prompt, SYSTEM_PROMPT);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as AiInsight[];
  } catch (err) {
    console.error("[ai-insights] Claude portfolio error:", err);
    return [];
  }
}
