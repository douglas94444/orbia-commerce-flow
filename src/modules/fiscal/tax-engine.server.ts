export type LocalDestino = "1" | "2" | "3";
export type TaxRegime = "simples" | "lucro_presumido" | "lucro_real";

export interface FiscalTaxRule {
  uf_destino: string;
  ncm_prefix: string;
  icms_aliquota: number | null;
  fcp_aliquota: number;
  difal_enabled: boolean;
  ipi_cst: string | null;
  mva_st: number | null;
}

/** 1=interna, 2=interestadual, 3=exterior */
export function resolveLocalDestino(emitterUf: string, destUf: string): LocalDestino {
  const e = emitterUf.trim().toUpperCase().slice(0, 2);
  const d = destUf.trim().toUpperCase().slice(0, 2);
  if (!e || !d) return "1";
  if (d === "EX") return "3";
  return e === d ? "1" : "2";
}

export interface ProductFiscalRow {
  sku: string;
  ncm: string | null;
  /** Legado — tratado como cfop_intra quando cfop_intra vazio */
  cfop: string | null;
  cfop_intra?: string | null;
  cfop_inter?: string | null;
  cfop_return_intra?: string | null;
  cfop_return_inter?: string | null;
  cst: string | null;
  cest?: string | null;
  icms_st?: boolean;
  icms_origem?: string;
  icms_rates?: Record<string, number>;
}

function legacyCfopIntra(product: ProductFiscalRow | null): string | null {
  if (!product) return null;
  return product.cfop_intra?.trim() || product.cfop?.trim() || null;
}

function legacyCfopInter(product: ProductFiscalRow | null): string | null {
  if (!product) return null;
  return product.cfop_inter?.trim() || null;
}

/** CFOP de venda respeitando local_destino — nunca usa CFOP intra em operação interestadual. */
export function resolveSaleCfop(
  localDestino: LocalDestino,
  defaultCfop: string | null,
  product: ProductFiscalRow | null,
): string {
  if (localDestino === "2") {
    const inter = legacyCfopInter(product);
    if (inter) return inter;
    const intra = legacyCfopIntra(product);
    if (intra?.startsWith("5")) return `6${intra.slice(1)}`;
    if (defaultCfop?.trim()) {
      const d = defaultCfop.trim();
      if (d.startsWith("5")) return `6${d.slice(1)}`;
      if (d.startsWith("6")) return d;
    }
    return "6102";
  }

  const intra = legacyCfopIntra(product);
  if (intra) return intra;
  if (defaultCfop?.trim()) return defaultCfop.trim();
  return "5102";
}

/** CFOP de devolução por local_destino e overrides do produto. */
export function resolveReturnCfop(
  localDestino: LocalDestino,
  defaultCfop: string | null,
  product: ProductFiscalRow | null,
): string {
  if (localDestino === "2") {
    const inter = product?.cfop_return_inter?.trim();
    if (inter) return inter;
    const saleInter = legacyCfopInter(product);
    if (saleInter?.startsWith("6")) {
      const mapped = `1${saleInter.slice(1)}`;
      if (mapped.startsWith("12")) return mapped;
    }
    if (defaultCfop?.trim()) {
      const d = defaultCfop.trim();
      if (d.startsWith("5")) return `1${d.slice(1)}`;
      if (d.startsWith("6")) return `1${d.slice(1)}`;
    }
    return "6202";
  }

  const intra = product?.cfop_return_intra?.trim();
  if (intra) return intra;
  const saleIntra = legacyCfopIntra(product);
  if (saleIntra?.startsWith("5")) return `1${saleIntra.slice(1)}`;
  if (defaultCfop?.trim()) {
    const d = defaultCfop.trim();
    if (d.startsWith("5")) return `1${d.slice(1)}`;
    if (d.startsWith("6")) return d.startsWith("62") ? d : `1${d.slice(1)}`;
  }
  return "1202";
}

/** Alíquota ICMS % — override por UF destino, fiscal_tax_rules ou tabela simplificada. */
const DEFAULT_INTER_RATE = 12;
const DEFAULT_INTRA_RATE = 18;

export async function loadFiscalTaxRule(
  clientId: string,
  ufDestino: string,
  ncm: string,
): Promise<FiscalTaxRule | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const dest = ufDestino.trim().toUpperCase().slice(0, 2);
  const ncmDigits = ncm.replace(/\D/g, "");

  const prefixes = ["", ...Array.from({ length: Math.min(8, ncmDigits.length) }, (_, i) =>
    ncmDigits.slice(0, ncmDigits.length - i),
  )].filter((p, idx, arr) => arr.indexOf(p) === idx);

  for (const prefix of prefixes) {
    const { data } = await supabaseAdmin
      .from("fiscal_tax_rules")
      .select("uf_destino, ncm_prefix, icms_aliquota, fcp_aliquota, difal_enabled, ipi_cst, mva_st")
      .eq("client_id", clientId)
      .eq("uf_destino", dest)
      .eq("ncm_prefix", prefix)
      .maybeSingle();

    if (data) {
      return {
        uf_destino: data.uf_destino,
        ncm_prefix: data.ncm_prefix,
        icms_aliquota: data.icms_aliquota != null ? Number(data.icms_aliquota) : null,
        fcp_aliquota: Number(data.fcp_aliquota ?? 0),
        difal_enabled: Boolean(data.difal_enabled),
        ipi_cst: data.ipi_cst,
        mva_st: data.mva_st != null ? Number(data.mva_st) : null,
      };
    }
  }

  return null;
}

export function resolveIcmsAliquota(
  emitterUf: string,
  destUf: string,
  productRates: Record<string, number>,
  taxRule?: FiscalTaxRule | null,
): number {
  if (taxRule?.icms_aliquota != null) return taxRule.icms_aliquota;

  const dest = destUf.trim().toUpperCase().slice(0, 2);
  if (dest && productRates[dest] != null) return productRates[dest];

  const local = resolveLocalDestino(emitterUf, destUf);
  if (local === "2") return DEFAULT_INTER_RATE;
  if (local === "1" && dest && productRates[emitterUf.trim().toUpperCase().slice(0, 2)] != null) {
    return productRates[emitterUf.trim().toUpperCase().slice(0, 2)];
  }
  return DEFAULT_INTRA_RATE;
}

export function resolveIpiCst(taxRule: FiscalTaxRule | null | undefined, defaultCst = "53"): string {
  return taxRule?.ipi_cst?.trim() || defaultCst;
}

export function resolveFcpAliquota(taxRule: FiscalTaxRule | null | undefined): number {
  return taxRule?.fcp_aliquota ?? 0;
}

export function resolveIcmsStMva(taxRule: FiscalTaxRule | null | undefined): number | null {
  return taxRule?.mva_st ?? null;
}

export function findTaxRuleFromList(
  rules: FiscalTaxRule[],
  ufDestino: string,
  ncm: string,
): FiscalTaxRule | null {
  const dest = ufDestino.trim().toUpperCase().slice(0, 2);
  const ncmDigits = ncm.replace(/\D/g, "");
  const prefixes = Array.from({ length: ncmDigits.length + 1 }, (_, i) => ncmDigits.slice(0, ncmDigits.length - i));

  for (const prefix of prefixes) {
    const match = rules.find((r) => r.uf_destino === dest && r.ncm_prefix === prefix);
    if (match) return match;
  }
  return null;
}

export async function loadClientTaxRules(clientId: string): Promise<FiscalTaxRule[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("fiscal_tax_rules")
    .select("uf_destino, ncm_prefix, icms_aliquota, fcp_aliquota, difal_enabled, ipi_cst, mva_st")
    .eq("client_id", clientId);
  return (data ?? []).map((r) => ({
    uf_destino: r.uf_destino,
    ncm_prefix: r.ncm_prefix,
    icms_aliquota: r.icms_aliquota != null ? Number(r.icms_aliquota) : null,
    fcp_aliquota: Number(r.fcp_aliquota ?? 0),
    difal_enabled: Boolean(r.difal_enabled),
    ipi_cst: r.ipi_cst,
    mva_st: r.mva_st != null ? Number(r.mva_st) : null,
  }));
}

/** Simples → CSOSN 102; LP/LR → CST 00 (tributada integralmente). */
export function resolveDefaultCst(
  taxRegime: string,
  configCst: string | null,
  productCst: string | null,
): string {
  if (productCst?.trim()) return productCst.trim();
  if (configCst?.trim()) return configCst.trim();
  return taxRegime === "simples" ? "102" : "00";
}

export function defaultCstPlaceholder(taxRegime: string): string {
  return taxRegime === "simples" ? "102 (CSOSN)" : "00 (CST)";
}

export function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  const d2 = calc(digits.slice(0, 12) + d1, w2);
  return digits.endsWith(`${d1}${d2}`);
}

export function validateNcm(ncm: string): boolean {
  return /^\d{8}$/.test(ncm.replace(/\D/g, ""));
}

export function validateCfop(cfop: string, kind: "sale_intra" | "sale_inter" | "return_intra" | "return_inter"): boolean {
  const d = cfop.replace(/\D/g, "");
  if (d.length !== 4) return false;
  const prefix = d[0];
  switch (kind) {
    case "sale_intra":
      return prefix === "5";
    case "sale_inter":
      return prefix === "6";
    case "return_intra":
      return prefix === "1";
    case "return_inter":
      return prefix === "2" || prefix === "6";
    default:
      return false;
  }
}

export interface ItemTaxBreakdown {
  pis_cst: string;
  cofins_cst: string;
  pis_aliquota: number;
  cofins_aliquota: number;
  icms_base: number;
  icms_valor: number;
  percentual_icms_interestadual?: number;
}

export function resolveItemTaxBreakdown(
  taxRegime: string,
  valorBruto: number,
  icmsAliquota: number,
  localDestino: LocalDestino,
): ItemTaxBreakdown {
  const icms_base = Math.round(valorBruto * 100) / 100;
  const icms_valor = Math.round((icms_base * icmsAliquota) / 100 * 100) / 100;

  if (taxRegime === "simples") {
    return {
      pis_cst: "07",
      cofins_cst: "07",
      pis_aliquota: 0,
      cofins_aliquota: 0,
      icms_base,
      icms_valor,
      percentual_icms_interestadual: localDestino === "2" ? icmsAliquota : undefined,
    };
  }

  return {
    pis_cst: "01",
    cofins_cst: "01",
    pis_aliquota: 1.65,
    cofins_aliquota: 7.6,
    icms_base,
    icms_valor,
    percentual_icms_interestadual: localDestino === "2" ? icmsAliquota : undefined,
  };
}

export function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(digits.slice(0, 9), 10);
  const d2 = calc(digits.slice(0, 10), 11);
  return digits.endsWith(`${d1}${d2}`);
}
