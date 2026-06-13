const TEMPORARY_PATTERNS = [
  /timeout/i,
  /indispon/i,
  /servidor/i,
  /conexao/i,
  /conexão/i,
  /temporar/i,
  /tente novamente/i,
  /processando/i,
  /lote em processamento/i,
];

const DEFINITIVE_PATTERNS = [
  /cnpj/i,
  /cpf/i,
  /ncm/i,
  /cfop/i,
  /cst/i,
  /inscri/i,
  /certificado/i,
  /rejei/i,
  /invalido/i,
  /inválido/i,
  /nao autorizado/i,
  /não autorizado/i,
  /duplicidade/i,
];

export type SefazErrorKind = "temporary" | "definitive" | "unknown";

export function classifySefazError(message: string | null | undefined): SefazErrorKind {
  if (!message?.trim()) return "unknown";
  const msg = message.trim();
  if (DEFINITIVE_PATTERNS.some((p) => p.test(msg))) return "definitive";
  if (TEMPORARY_PATTERNS.some((p) => p.test(msg))) return "temporary";
  return "unknown";
}

export function shouldAutoRetry(errorKind: SefazErrorKind, retries: number, maxRetries = 3): boolean {
  if (retries >= maxRetries) return false;
  return errorKind === "temporary" || errorKind === "unknown";
}
