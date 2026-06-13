import { getServerConfig } from "@/lib/config.server";
import { mapTaxRegimeToFocus, upsertFocusEmpresa } from "@/integrations/focus-nfe/empresa";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCertificateForClient } from "./fiscal-cert.server";

export interface FiscalConfigRow {
  id: string;
  client_id: string;
  cnpj: string;
  company_name: string;
  tax_regime: string;
  state_uf: string;
  state_registration: string | null;
  municipal_registration: string | null;
  municipality_code: string | null;
  cert_path: string | null;
  cert_password: string | null;
}

export async function syncFiscalConfigToFocus(clientId: string): Promise<void> {
  const { focusNfe, appUrl } = getServerConfig();
  if (!focusNfe.token) {
    console.warn("[fiscal] FOCUS_NFE_TOKEN not set — skipping Focus empresa sync");
    return;
  }

  const { data: fiscal, error } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "id, client_id, cnpj, company_name, tax_regime, state_uf, state_registration, municipal_registration, municipality_code, cert_path, cert_password",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  if (error || !fiscal) throw new Error("Configuração fiscal não encontrada");

  const cert = await loadCertificateForClient(
    clientId,
    fiscal.cert_path,
    fiscal.cert_password,
  );

  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/focus-nfe`;

  const payload = {
    nome: fiscal.company_name,
    nome_fantasia: fiscal.company_name.slice(0, 60),
    cnpj: fiscal.cnpj.replace(/\D/g, ""),
    inscricao_estadual: fiscal.state_registration ?? undefined,
    inscricao_municipal: fiscal.municipal_registration ?? undefined,
    codigo_municipio: fiscal.municipality_code ?? undefined,
    regime_tributario: mapTaxRegimeToFocus(fiscal.tax_regime),
    uf: (fiscal.state_uf ?? "SP").toUpperCase(),
    certificado_especifico: true,
    habilita_nfe: true,
    habilita_nfce: true,
    habilita_nfse: Boolean(fiscal.municipal_registration),
    url_notificacao: webhookUrl,
    ...(cert?.base64 && cert.password
      ? {
          arquivo_certificado_base64: cert.base64,
          senha_certificado: cert.password,
        }
      : {}),
  };

  await upsertFocusEmpresa(payload, focusNfe.token, focusNfe.env);

  const updateFields: Record<string, string> = {
    focus_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (cert?.expiresAt) {
    updateFields.cert_expires_at = cert.expiresAt;
  }

  await supabaseAdmin.from("fiscal_configs").update(updateFields).eq("client_id", clientId);
}
