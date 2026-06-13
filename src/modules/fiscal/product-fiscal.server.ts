import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { FocusNfeItem } from "@/integrations/focus-nfe";
import type { NormalizedOrderItem } from "@/modules/logistics/order-ingestion.server";
import {
  resolveDefaultCst,
  resolveIcmsAliquota,
  resolveItemTaxBreakdown,
  resolveLocalDestino,
  resolveReturnCfop,
  resolveSaleCfop,
  resolveIpiCst,
  resolveFcpAliquota,
  resolveIcmsStMva,
  type FiscalTaxRule,
  type LocalDestino,
  type ProductFiscalRow,
} from "./tax-engine.server";

export interface ProductFiscalConfigDefaults {
  default_cfop: string | null;
  default_cst: string | null;
  default_ncm: string | null;
  state_uf: string;
  tax_regime: string;
}

export async function loadProductFiscalBySkus(
  clientId: string,
  skus: string[],
): Promise<Map<string, ProductFiscalRow>> {
  const map = new Map<string, ProductFiscalRow>();
  if (skus.length === 0) return map;

  const { data } = await supabaseAdmin
    .from("products")
    .select(
      "sku, ncm, cfop, cfop_intra, cfop_inter, cfop_return_intra, cfop_return_inter, cst, cest, icms_st, icms_origem, icms_rates",
    )
    .eq("client_id", clientId)
    .in("sku", skus);

  for (const row of data ?? []) {
    const rates = row.icms_rates as Record<string, number> | null;
    map.set(row.sku as string, {
      sku: row.sku as string,
      ncm: row.ncm as string | null,
      cfop: row.cfop as string | null,
      cfop_intra: row.cfop_intra as string | null,
      cfop_inter: row.cfop_inter as string | null,
      cfop_return_intra: row.cfop_return_intra as string | null,
      cfop_return_inter: row.cfop_return_inter as string | null,
      cst: row.cst as string | null,
      cest: row.cest as string | null,
      icms_st: Boolean(row.icms_st),
      icms_origem: (row.icms_origem as string) ?? "0",
      icms_rates: rates ?? {},
    });
  }
  return map;
}

export function enrichSaleItemFiscal(
  item: NormalizedOrderItem,
  product: ProductFiscalRow | undefined,
  fiscal: ProductFiscalConfigDefaults,
  localDestino: LocalDestino,
  destUf: string,
  taxRule?: FiscalTaxRule | null,
): NormalizedOrderItem & {
  cfop: string;
  cst: string;
  ncm: string;
  cest?: string;
  icms_origem: string;
  icms_aliquota?: number;
  icms_st?: boolean;
  ipi_cst?: string;
  fcp_aliquota?: number;
  mva_st?: number | null;
  difal_enabled?: boolean;
} {
  const cfop = resolveSaleCfop(localDestino, fiscal.default_cfop, product ?? null);
  const cst = resolveDefaultCst(
    fiscal.tax_regime,
    fiscal.default_cst,
    product?.cst ?? item.cst ?? null,
  );
  const ncm = product?.ncm ?? item.ncm ?? fiscal.default_ncm ?? "61091000";
  const icms_aliquota = resolveIcmsAliquota(
    fiscal.state_uf,
    destUf,
    product?.icms_rates ?? {},
    taxRule,
  );

  return {
    ...item,
    cfop,
    cst,
    ncm,
    cest: product?.cest ?? undefined,
    icms_origem: product?.icms_origem ?? "0",
    icms_aliquota,
    icms_st: product?.icms_st ?? Boolean(taxRule?.mva_st),
    ipi_cst: resolveIpiCst(taxRule),
    fcp_aliquota: resolveFcpAliquota(taxRule),
    mva_st: resolveIcmsStMva(taxRule),
    difal_enabled: taxRule?.difal_enabled ?? false,
  };
}

export function buildFocusNfeItemFromEnriched(
  item: NormalizedOrderItem & {
    cfop: string;
    cst: string;
    ncm: string;
    cest?: string;
    icms_origem?: string;
    icms_aliquota?: number;
    icms_st?: boolean;
    barcode?: string;
    ipi_cst?: string;
    fcp_aliquota?: number;
    mva_st?: number | null;
    difal_enabled?: boolean;
  },
  index: number,
  fiscal: ProductFiscalConfigDefaults,
  localDestino: LocalDestino,
  taxRule?: FiscalTaxRule | null,
): FocusNfeItem {
  const valorBruto = (item.unitPriceCents * item.quantity) / 100;
  const icmsAliquota = item.icms_aliquota ?? 0;
  const taxes = resolveItemTaxBreakdown(
    fiscal.tax_regime,
    valorBruto,
    icmsAliquota,
    localDestino,
  );

  const base: FocusNfeItem = {
    numero_item: String(index + 1),
    codigo_produto: item.sku,
    descricao: item.name.slice(0, 120),
    cfop: item.cfop,
    unidade_comercial: "UN",
    quantidade_comercial: item.quantity,
    valor_unitario_comercial: item.unitPriceCents / 100,
    valor_bruto: valorBruto,
    codigo_ncm: item.ncm,
    icms_situacao_tributaria: item.cst,
    icms_origem: item.icms_origem ?? "0",
    icms_base_calculo: taxes.icms_base,
    icms_valor: taxes.icms_valor,
    pis_situacao_tributaria: taxes.pis_cst,
    pis_aliquota: taxes.pis_aliquota,
    pis_base_calculo: taxes.icms_base,
    pis_valor: Math.round((taxes.icms_base * taxes.pis_aliquota) / 100 * 100) / 100,
    cofins_situacao_tributaria: taxes.cofins_cst,
    cofins_aliquota: taxes.cofins_aliquota,
    cofins_base_calculo: taxes.icms_base,
    cofins_valor: Math.round((taxes.icms_base * taxes.cofins_aliquota) / 100 * 100) / 100,
    ipi_situacao_tributaria: item.ipi_cst ?? "53",
  };

  if (item.cest) base.cest = item.cest;
  if (icmsAliquota > 0) base.icms_aliquota = icmsAliquota;
  if (taxes.percentual_icms_interestadual != null) {
    base.percentual_icms_interestadual = taxes.percentual_icms_interestadual;
  }
  if (item.icms_st) base.icms_modalidade_base_calculo_st = "4";
  if (item.barcode) base.codigo_barras_comercial = item.barcode;

  const fcpAliq = item.fcp_aliquota ?? resolveFcpAliquota(taxRule);
  if (fcpAliq > 0) {
    base.percentual_fcp = fcpAliq;
    base.valor_fcp = Math.round((valorBruto * fcpAliq) / 100 * 100) / 100;
  }

  const mva = item.mva_st ?? resolveIcmsStMva(taxRule);
  if (item.icms_st && mva != null && mva > 0) {
    const baseSt = Math.round(valorBruto * (1 + mva / 100) * 100) / 100;
    base.icms_base_calculo_st = baseSt;
    base.icms_aliquota_st = icmsAliquota;
    base.icms_valor_st = Math.round((baseSt * icmsAliquota) / 100 * 100) / 100;
  }

  if ((item.difal_enabled || taxRule?.difal_enabled) && localDestino === "2" && icmsAliquota > 0) {
    base.percentual_icms_interestadual = icmsAliquota;
  }

  return base;
}

export function enrichReturnItemFiscal(
  sku: string,
  qty: number,
  unitCents: number,
  product: ProductFiscalRow | undefined,
  fiscal: ProductFiscalConfigDefaults,
  localDestino: LocalDestino,
  destUf: string,
): FocusNfeItem & { sku: string } {
  const cfop = resolveReturnCfop(localDestino, fiscal.default_cfop, product ?? null);
  const cst = resolveDefaultCst(fiscal.tax_regime, fiscal.default_cst, product?.cst ?? null);
  const ncm = product?.ncm ?? fiscal.default_ncm ?? "00000000";
  const icms_aliquota = resolveIcmsAliquota(fiscal.state_uf, destUf, product?.icms_rates ?? {});

  const item: FocusNfeItem = {
    numero_item: "0",
    codigo_produto: sku,
    descricao: `Devolucao ${sku}`,
    cfop,
    unidade_comercial: "UN",
    quantidade_comercial: qty,
    valor_unitario_comercial: unitCents / 100,
    valor_bruto: (unitCents * qty) / 100,
    codigo_ncm: ncm,
    icms_situacao_tributaria: cst,
    icms_origem: product?.icms_origem ?? "0",
  };

  if (product?.cest) item.cest = product.cest;
  if (icms_aliquota > 0) item.icms_aliquota = icms_aliquota;
  if (product?.icms_st) item.icms_modalidade_base_calculo_st = "4";

  return { ...item, sku };
}

export async function getSkusMissingNcm(
  clientId: string,
  limit = 10,
): Promise<Array<{ sku: string; name: string }>> {
  const { data } = await supabaseAdmin
    .from("products")
    .select("sku, name")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .or("ncm.is.null,ncm.eq.")
    .limit(limit);

  return (data ?? []).map((r) => ({ sku: r.sku as string, name: r.name as string }));
}

export async function countProductFiscalStats(clientId: string): Promise<{
  totalActive: number;
  withNcm: number;
  incomplete: number;
}> {
  const { data } = await supabaseAdmin
    .from("products")
    .select("ncm")
    .eq("client_id", clientId)
    .eq("is_active", true);

  const rows = data ?? [];
  const totalActive = rows.length;
  const withNcm = rows.filter((r) => r.ncm && String(r.ncm).replace(/\D/g, "").length === 8).length;
  return { totalActive, withNcm, incomplete: totalActive - withNcm };
}
