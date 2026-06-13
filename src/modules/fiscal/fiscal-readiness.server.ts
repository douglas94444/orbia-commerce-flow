import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateCnpj } from "./tax-engine.server";
import { syncFiscalConfigToFocus } from "./focus-empresa-sync.server";
import { validateProductFiscalReadiness } from "./product-fiscal-readiness.server";

export type ReadinessStatus = "ok" | "warning" | "error";

export interface ReadinessItem {
  key: string;
  label: string;
  status: ReadinessStatus;
  message?: string;
}

export interface FiscalReadinessResult {
  ready: boolean;
  items: ReadinessItem[];
}

const FOCUS_SYNC_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function validateFiscalReadiness(
  clientId: string,
  options?: { attemptFocusSync?: boolean; docType?: "nfe" | "nfce" | "nfse" },
): Promise<FiscalReadinessResult> {
  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select(
      "cnpj, company_name, tax_regime, state_uf, state_registration, municipal_registration, municipality_code, default_ncm, cert_path, cert_password, cert_expires_at, focus_synced_at, nfce_csc_id, nfce_csc_token, auto_emit_nfe",
    )
    .eq("client_id", clientId)
    .maybeSingle();

  const items: ReadinessItem[] = [];

  if (!fiscal) {
    return {
      ready: false,
      items: [
        {
          key: "config",
          label: "Configuração fiscal",
          status: "error",
          message: "Nenhuma configuração cadastrada",
        },
      ],
    };
  }

  items.push({
    key: "cnpj",
    label: "CNPJ válido",
    status: validateCnpj(fiscal.cnpj) ? "ok" : "error",
    message: validateCnpj(fiscal.cnpj) ? undefined : "Dígitos verificadores inválidos",
  });

  items.push({
    key: "company",
    label: "Razão social",
    status: fiscal.company_name?.trim().length >= 2 ? "ok" : "error",
  });

  items.push({
    key: "state_uf",
    label: "UF do emitente",
    status: fiscal.state_uf?.length === 2 ? "ok" : "error",
  });

  items.push({
    key: "state_registration",
    label: "Inscrição estadual",
    status: fiscal.state_registration?.trim() ? "ok" : "error",
    message: "Obrigatória para NF-e em produção (use ISENTO se aplicável)",
  });

  items.push({
    key: "default_ncm",
    label: "NCM padrão",
    status: fiscal.default_ncm?.trim() ? "ok" : "warning",
    message: "Recomendado para itens sem NCM no catálogo",
  });

  const hasCert = Boolean(fiscal.cert_path);
  const hasPassword = Boolean(fiscal.cert_password);
  items.push({
    key: "certificate",
    label: "Certificado A1",
    status: hasCert && hasPassword ? "ok" : "error",
    message: !hasCert ? "Faça upload do .pfx" : !hasPassword ? "Informe a senha do certificado" : undefined,
  });

  if (fiscal.cert_expires_at) {
    const expired = new Date(fiscal.cert_expires_at).getTime() < Date.now();
    items.push({
      key: "cert_expiry",
      label: "Validade do certificado",
      status: expired ? "error" : "ok",
      message: expired ? "Certificado vencido" : undefined,
    });
  }

  let focusSyncedAt = fiscal.focus_synced_at;
  const syncStale =
    !focusSyncedAt ||
    Date.now() - new Date(focusSyncedAt).getTime() > FOCUS_SYNC_MAX_AGE_MS;

  if (options?.attemptFocusSync && syncStale && hasCert && hasPassword) {
    try {
      await syncFiscalConfigToFocus(clientId);
      const { data: refreshed } = await supabaseAdmin
        .from("fiscal_configs")
        .select("focus_synced_at")
        .eq("client_id", clientId)
        .maybeSingle();
      focusSyncedAt = refreshed?.focus_synced_at ?? focusSyncedAt;
    } catch (err) {
      items.push({
        key: "focus_sync",
        label: "Sincronização Focus NFe",
        status: "error",
        message: (err as Error).message,
      });
    }
  }

  const synced =
    focusSyncedAt &&
    Date.now() - new Date(focusSyncedAt).getTime() <= FOCUS_SYNC_MAX_AGE_MS;

  if (!items.some((i) => i.key === "focus_sync")) {
    items.push({
      key: "focus_sync",
      label: "Empresa cadastrada na Focus",
      status: synced ? "ok" : "error",
      message: synced ? undefined : "Salve a config ou reenvie o certificado para sincronizar",
    });
  }

  const productReadiness = await validateProductFiscalReadiness(clientId);
  items.push({
    key: "product_ncm",
    label: "NCM por SKU ativo",
    status: productReadiness.ready ? "ok" : productReadiness.incomplete > 0 ? "warning" : "ok",
    message: productReadiness.ready
      ? undefined
      : `${productReadiness.incomplete} SKU(s) sem NCM (${productReadiness.coveragePct}% cobertura)`,
  });

  if (options?.docType === "nfce" || options?.docType === undefined) {
    const { data: nfceSettings } = await supabaseAdmin
      .from("fiscal_nfce_settings")
      .select("csc_id, csc_token")
      .eq("client_id", clientId)
      .maybeSingle();

    const hasCsc =
      Boolean(fiscal.nfce_csc_id && fiscal.nfce_csc_token) ||
      Boolean(nfceSettings?.csc_id && nfceSettings?.csc_token);

    if (options?.docType === "nfce") {
      items.push({
        key: "nfce_csc",
        label: "CSC NFC-e",
        status: hasCsc ? "ok" : "error",
        message: hasCsc ? undefined : "Configure CSC id/token em /fiscal/config",
      });
    }
  }

  if (options?.docType === "nfse") {
    items.push({
      key: "municipal_registration",
      label: "Inscrição municipal",
      status: fiscal.municipal_registration?.trim() ? "ok" : "error",
      message: "Obrigatória para NFS-e",
    });
    items.push({
      key: "municipality_code",
      label: "Código município IBGE",
      status: fiscal.municipality_code?.trim() ? "ok" : "error",
    });

    const { count } = await supabaseAdmin
      .from("fiscal_service_catalog")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    items.push({
      key: "service_catalog",
      label: "Catálogo de serviços ISS",
      status: (count ?? 0) > 0 ? "ok" : "error",
      message: (count ?? 0) > 0 ? undefined : "Cadastre serviços em /fiscal/services",
    });
  }

  const blocking = items.filter((i) => i.status === "error");
  return {
    ready: blocking.length === 0,
    items,
  };
}
