export type LocalDestino = "1" | "2" | "3";
export type TaxRegime = "simples" | "lucro_presumido" | "lucro_real";

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

/** Alíquota ICMS % — override por UF destino ou tabela interestadual simplificada. */
const DEFAULT_INTER_RATE = 12;
const DEFAULT_INTRA_RATE = 18;

export function resolveIcmsAliquota(
  emitterUf: string,
  destUf: string,
  productRates: Record<string, number>,
): number {
  const dest = destUf.trim().toUpperCase().slice(0, 2);
  if (dest && productRates[dest] != null) return productRates[dest];

  const local = resolveLocalDestino(emitterUf, destUf);
  if (local === "2") return DEFAULT_INTER_RATE;
  if (local === "1" && dest && productRates[emitterUf.trim().toUpperCase().slice(0, 2)] != null) {
    return productRates[emitterUf.trim().toUpperCase().slice(0, 2)];
  }
  return DEFAULT_INTRA_RATE;
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
