import { getFocusNfeBaseUrl } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

export interface FocusNfeItem {
  numero_item: string;
  codigo_produto: string;
  descricao: string;
  cfop: string;
  unidade_comercial: string;
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_bruto: number;
  codigo_ncm: string;
  icms_situacao_tributaria: string;
  icms_origem: string;
}

export interface FocusNfePayload {
  natureza_operacao: string;
  data_emissao: string;
  tipo_documento: string;
  local_destino: string;
  finalidade_emissao: string;
  consumidor_final: string;
  presenca_comprador: string;
  cnpj_emitente: string;
  nome_destinatario: string;
  cpf_destinatario?: string;
  logradouro_destinatario: string;
  numero_destinatario: string;
  bairro_destinatario: string;
  municipio_destinatario: string;
  uf_destinatario: string;
  cep_destinatario: string;
  items: FocusNfeItem[];
}

export interface FocusNfeResponse {
  status: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfe?: string;
  erros?: Array<{ mensagem: string }>;
}

function authHeader(token: string): string {
  const encoded = Buffer.from(`${token}:`).toString("base64");
  return `Basic ${encoded}`;
}

export async function emitNFe(
  ref: string,
  payload: FocusNfePayload,
  token: string,
): Promise<FocusNfeResponse> {
  const end = startTimer();
  const base = getFocusNfeBaseUrl();
  const res = await fetch(`${base}/v2/nfe?ref=${encodeURIComponent(ref)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as FocusNfeResponse;
  await logIntegration({
    provider: "focus_nfe",
    operation: "emitNFe",
    status: res.ok && body.status !== "erro_autorizacao" ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: body.mensagem_sefaz ?? body.erros?.[0]?.mensagem,
    metadata: { ref, status: body.status },
  });

  if (!res.ok) {
    throw new Error(
      body.mensagem_sefaz ?? body.erros?.[0]?.mensagem ?? `Focus NFe HTTP ${res.status}`,
    );
  }

  return body;
}

export async function getNFeStatus(ref: string, token: string): Promise<FocusNfeResponse> {
  const end = startTimer();
  const base = getFocusNfeBaseUrl();
  const res = await fetch(`${base}/v2/nfe/${encodeURIComponent(ref)}`, {
    headers: { Authorization: authHeader(token) },
  });

  const body = (await res.json()) as FocusNfeResponse;
  await logIntegration({
    provider: "focus_nfe",
    operation: "getNFeStatus",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    metadata: { ref, status: body.status },
  });

  if (!res.ok) throw new Error(`Focus NFe status check failed: ${res.status}`);
  return body;
}

export async function emitNFeWithRetry(
  ref: string,
  payload: FocusNfePayload,
  token: string,
  maxAttempts = 3,
): Promise<FocusNfeResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let result = await emitNFe(ref, payload, token);
      if (result.status === "processando_autorizacao") {
        await new Promise((r) => setTimeout(r, 2000));
        result = await getNFeStatus(ref, token);
      }
      if (result.status === "autorizado") return result;
      lastError = new Error(result.mensagem_sefaz ?? result.erros?.[0]?.mensagem ?? "NF rejeitada");
    } catch (err) {
      lastError = err as Error;
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }

  throw lastError ?? new Error("Focus NFe emission failed");
}
