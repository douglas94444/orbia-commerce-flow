import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callClaude } from "@/integrations/claude/client.server";

export async function analyzeSacSentiment(ticketId: string): Promise<{
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
}> {
  const { data: messages } = await supabaseAdmin
    .from("sac_messages")
    .select("body, sender_type")
    .eq("ticket_id", ticketId)
    .eq("sender_type", "customer")
    .order("created_at")
    .limit(5);

  const text = (messages ?? []).map((m) => m.body).join("\n");
  if (!text.trim()) return { sentiment: "neutral", confidence: 0.5 };

  try {
    const raw = await callClaude(
      `Analise o sentimento destas mensagens de cliente SAC:\n${text}`,
      'Responda APENAS JSON: {"sentiment":"positive|neutral|negative","confidence":0.0-1.0}',
    );
    const parsed = JSON.parse(raw) as { sentiment: string; confidence: number };
    const sentiment = ["positive", "neutral", "negative"].includes(parsed.sentiment)
      ? (parsed.sentiment as "positive" | "neutral" | "negative")
      : "neutral";

    await supabaseAdmin.from("sac_sentiment_scores").insert({
      ticket_id: ticketId,
      sentiment,
      confidence: parsed.confidence ?? 0.7,
    });

    return { sentiment, confidence: parsed.confidence ?? 0.7 };
  } catch {
    return { sentiment: "neutral", confidence: 0.5 };
  }
}

export async function batchAnalyzeSentiment(limit = 20): Promise<number> {
  const { data: tickets } = await supabaseAdmin
    .from("sac_tickets")
    .select("id")
    .in("status", ["open", "in_progress", "resolved"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  let analyzed = 0;
  for (const t of tickets ?? []) {
    const { data: existing } = await supabaseAdmin
      .from("sac_sentiment_scores")
      .select("id")
      .eq("ticket_id", t.id)
      .limit(1)
      .maybeSingle();
    if (existing) continue;
    await analyzeSacSentiment(t.id);
    analyzed++;
  }
  return analyzed;
}
