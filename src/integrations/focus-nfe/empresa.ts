import { getFocusNfeBaseUrl } from "@/lib/config.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";

export interface FocusEmpresaPayload {
  nome: string;
  nome_fantasia?: string;
  cnpj: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  codigo_municipio?: string;
  regime_tributario: number;
  uf: string;
  municipio?: string;
  arquivo_certificado_base64?: string;
  senha_certificado?: string;
  certificado_especifico?: boolean;
  url_notificacao?: string;
  habilita_nfe?: boolean;
  habilita_nfce?: boolean;
  habilita_nfse?: boolean;
}

export interface FocusEmpresaResponse {
  cnpj?: string;
  status?: string;
  mensagem?: string;
  erros?: Array<{ mensagem: string }>;
}

function authHeader(token: string): string {
  const encoded = Buffer.from(`${token}:`).toString("base64");
  return `Basic ${encoded}`;
}

export function mapTaxRegimeToFocus(regime: string): number {
  if (regime === "simples") return 1;
  if (regime === "lucro_presumido") return 2;
  return 3;
}

export async function getFocusEmpresa(
  cnpj: string,
  token: string,
): Promise<FocusEmpresaResponse | null> {
  const end = startTimer();
  const base = getFocusNfeBaseUrl();
  const res = await fetch(`${base}/v2/empresas/${cnpj}`, {
    headers: { Authorization: authHeader(token) },
  });

  if (res.status === 404) return null;

  const body = (await res.json()) as FocusEmpresaResponse;
  await logIntegration({
    provider: "focus_nfe",
    operation: "getFocusEmpresa",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    metadata: { cnpj },
  });

  if (!res.ok) {
    throw new Error(body.mensagem ?? body.erros?.[0]?.mensagem ?? `Focus empresa GET ${res.status}`);
  }

  return body;
}

export async function upsertFocusEmpresa(
  payload: FocusEmpresaPayload,
  token: string,
  focusEnv: string,
): Promise<FocusEmpresaResponse> {
  const end = startTimer();
  const base = getFocusNfeBaseUrl();
  const dryRun = focusEnv !== "producao" ? "?dry_run=1" : "";
  const cnpj = payload.cnpj.replace(/\D/g, "");

  const existing = await getFocusEmpresa(cnpj, token).catch(() => null);
  const method = existing ? "PUT" : "POST";
  const url =
    method === "PUT"
      ? `${base}/v2/empresas/${cnpj}${dryRun}`
      : `${base}/v2/empresas${dryRun}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(token),
    },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as FocusEmpresaResponse;
  await logIntegration({
    provider: "focus_nfe",
    operation: "upsertFocusEmpresa",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    error_message: body.mensagem ?? body.erros?.[0]?.mensagem,
    metadata: { cnpj, method, dry_run: focusEnv !== "producao" },
  });

  if (!res.ok) {
    throw new Error(
      body.mensagem ?? body.erros?.[0]?.mensagem ?? `Focus empresa ${method} HTTP ${res.status}`,
    );
  }

  return body;
}
