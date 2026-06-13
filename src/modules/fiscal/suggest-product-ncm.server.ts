import { callClaude } from "@/integrations/claude/client.server";

export async function suggestProductNcm(
  productName: string,
  category?: string,
): Promise<{ ncm: string; rationale: string }> {
  const system = `Você é especialista fiscal brasileiro. Responda APENAS com JSON válido:
{"ncm":"########","rationale":"uma frase curta"}
O NCM deve ter exatamente 8 dígitos numéricos da Nomenclatura Comum do Mercosul.`;

  const prompt = `Sugira o NCM mais adequado para este produto de e-commerce:
Nome: ${productName}
${category ? `Categoria: ${category}` : ""}`;

  const raw = await callClaude(prompt, system);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta da IA inválida");

  const parsed = JSON.parse(match[0]) as { ncm?: string; rationale?: string };
  const ncm = String(parsed.ncm ?? "").replace(/\D/g, "");
  if (ncm.length !== 8) throw new Error("NCM sugerido inválido");

  return { ncm, rationale: parsed.rationale ?? "Sugestão automática" };
}
