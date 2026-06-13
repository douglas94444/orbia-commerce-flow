import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateFiscalReadiness } from "./fiscal-readiness.server";
import { countProductFiscalStats } from "./product-fiscal.server";

export interface FiscalOnboardingItem {
  key: string;
  label: string;
  done: boolean;
  href?: string;
}

export interface FiscalOnboardingChecklist {
  ready: boolean;
  items: FiscalOnboardingItem[];
  coveragePct: number;
}

export async function getFiscalOnboardingChecklist(clientId: string): Promise<FiscalOnboardingChecklist> {
  const [readiness, productStats, { count: serviceCount }] = await Promise.all([
    validateFiscalReadiness(clientId),
    countProductFiscalStats(clientId),
    supabaseAdmin
      .from("fiscal_service_catalog")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
  ]);

  const { data: fiscal } = await supabaseAdmin
    .from("fiscal_configs")
    .select("cert_path, nfce_csc_id, nfce_csc_token, auto_emit_nfce, auto_emit_nfse")
    .eq("client_id", clientId)
    .maybeSingle();

  const coveragePct =
    productStats.totalActive > 0
      ? Math.round((productStats.withNcm / productStats.totalActive) * 100)
      : 100;

  const items: FiscalOnboardingItem[] = [
    {
      key: "config",
      label: "Configuração fiscal (CNPJ, IE, certificado)",
      done: readiness.items.filter((i) => ["cnpj", "certificate", "state_registration"].includes(i.key)).every((i) => i.status === "ok"),
      href: "/fiscal/config",
    },
    {
      key: "ncm",
      label: `NCM em SKUs ativos (${coveragePct}% cobertura)`,
      done: productStats.incomplete === 0,
      href: "/catalog/fiscal",
    },
    {
      key: "nfce_csc",
      label: "CSC NFC-e (se PDV/balcão)",
      done: !fiscal?.auto_emit_nfce || Boolean(fiscal.nfce_csc_id && fiscal.nfce_csc_token),
      href: "/fiscal/config",
    },
    {
      key: "nfse_services",
      label: "Catálogo ISS (se NFS-e)",
      done: !fiscal?.auto_emit_nfse || (serviceCount ?? 0) > 0,
      href: "/fiscal/services",
    },
    {
      key: "focus_sync",
      label: "Empresa sincronizada na Focus",
      done: readiness.items.find((i) => i.key === "focus_sync")?.status === "ok",
      href: "/fiscal/config",
    },
  ];

  return {
    ready: items.every((i) => i.done),
    items,
    coveragePct,
  };
}
