export type LocalDestino = "1" | "2" | "3";

/** 1=interna, 2=interestadual, 3=exterior */
export function resolveLocalDestino(emitterUf: string, destUf: string): LocalDestino {
  const e = emitterUf.trim().toUpperCase().slice(0, 2);
  const d = destUf.trim().toUpperCase().slice(0, 2);
  if (!e || !d) return "1";
  if (d === "EX") return "3";
  return e === d ? "1" : "2";
}

export function resolveSaleCfop(
  localDestino: LocalDestino,
  defaultCfop: string | null,
  productCfop: string | null,
): string {
  if (productCfop?.trim()) return productCfop.trim();
  if (defaultCfop?.trim()) return defaultCfop.trim();
  return localDestino === "2" ? "6102" : "5102";
}

export function resolveReturnCfop(localDestino: LocalDestino, defaultCfop: string | null): string {
  if (defaultCfop?.trim()) {
    const d = defaultCfop.trim();
    if (d.startsWith("5")) return `1${d.slice(1)}`;
    if (d.startsWith("6")) return d;
  }
  return localDestino === "2" ? "6202" : "1202";
}

export interface ProductFiscalRow {
  sku: string;
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
}
