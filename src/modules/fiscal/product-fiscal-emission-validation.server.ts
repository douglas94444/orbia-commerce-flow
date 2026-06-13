import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";
import { loadProductFiscalBySkus } from "./product-fiscal.server";
import { validateNcm } from "./tax-engine.server";
import { validateCstForRegime } from "./product-fiscal-validation.server";

export async function validateProductFiscalForEmission(
  clientId: string,
  items: NormalizedOrderItem[],
  defaultNcm: string | null,
  taxRegime: string,
): Promise<{ ok: boolean; message: string }> {
  if (items.length === 0) return { ok: true, message: "" };

  const productFiscal = await loadProductFiscalBySkus(
    clientId,
    items.map((i) => i.sku).filter(Boolean),
  );

  const errors: string[] = [];

  for (const item of items) {
    const pf = productFiscal.get(item.sku);
    const ncm = pf?.ncm ?? item.ncm ?? defaultNcm;
    if (!ncm || !validateNcm(String(ncm))) {
      errors.push(`${item.sku}: NCM inválido`);
      continue;
    }

    const cst = pf?.cst ?? item.cst;
    if (cst && !validateCstForRegime(cst, taxRegime)) {
      errors.push(`${item.sku}: CST/CSOSN inválido para regime`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      message: `Fiscal de produto incompleto: ${errors.slice(0, 5).join("; ")}. Ajuste em /catalog/fiscal`,
    };
  }

  return { ok: true, message: "" };
}
