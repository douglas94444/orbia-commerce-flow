import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listChannelListings,
  listProducts,
  syncAllCatalogsFn,
  syncClientCatalog,
  publishSkuToChannelsFn,
  previewChannelPriceFn,
  getPricingRulesFn,
  upsertPricingRuleFn,
  getStockBuffersFn,
  upsertStockBufferFn,
  upsertProductFiscal,
  getProductFiscalReadinessFn,
  suggestProductNcmFn,
  listFiscalTemplatesFn,
  upsertFiscalTemplateFn,
  applyFiscalTemplateFn,
  bulkImportProductFiscalFn,
} from "../actions.functions";

export const PRODUCTS_KEY = ["products"] as const;
export const LISTINGS_KEY = ["channel-listings"] as const;
export const PRICING_RULES_KEY = ["pricing-rules"] as const;
export const STOCK_BUFFERS_KEY = ["stock-buffers"] as const;
export const FISCAL_READINESS_KEY = ["product-fiscal-readiness"] as const;
export const FISCAL_TEMPLATES_KEY = ["fiscal-templates"] as const;

export function useProducts() {
  return useQuery({
    queryKey: PRODUCTS_KEY,
    queryFn: () => listProducts(),
    staleTime: 60_000,
  });
}

export function useChannelListings() {
  return useQuery({
    queryKey: LISTINGS_KEY,
    queryFn: () => listChannelListings(),
    staleTime: 60_000,
  });
}

export function usePricingRules() {
  return useQuery({
    queryKey: PRICING_RULES_KEY,
    queryFn: () => getPricingRulesFn(),
    staleTime: 60_000,
  });
}

export function useStockBuffers() {
  return useQuery({
    queryKey: STOCK_BUFFERS_KEY,
    queryFn: () => getStockBuffersFn(),
    staleTime: 60_000,
  });
}

export function useProductFiscalReadiness() {
  return useQuery({
    queryKey: FISCAL_READINESS_KEY,
    queryFn: () => getProductFiscalReadinessFn(),
    staleTime: 30_000,
  });
}

export function useFiscalTemplates() {
  return useQuery({
    queryKey: FISCAL_TEMPLATES_KEY,
    queryFn: () => listFiscalTemplatesFn(),
    staleTime: 60_000,
  });
}

export function useSyncClientCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => syncClientCatalog({ data: { clientId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: LISTINGS_KEY });
    },
  });
}

export function useSyncAllCatalogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncAllCatalogsFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: LISTINGS_KEY });
      qc.invalidateQueries({ queryKey: FISCAL_READINESS_KEY });
      toast.success("Catálogos sincronizados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePublishSku() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sku: string; channels?: string[] }) =>
      publishSkuToChannelsFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LISTINGS_KEY });
      toast.success("SKU publicado nos canais selecionados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertPricingRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      channel: string;
      ruleType: "margin_pct" | "markup_pct" | "fixed_cents";
      value: number;
      minPriceCents?: number;
    }) => upsertPricingRuleFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRICING_RULES_KEY });
      toast.success("Regra de preço salva.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertStockBuffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { channel: string; bufferPct: number; blackoutWhenZero?: boolean }) =>
      upsertStockBufferFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STOCK_BUFFERS_KEY });
      toast.success("Buffer de estoque salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertProductFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      productId: string;
      ncm?: string | null;
      cfopIntra?: string | null;
      cfopInter?: string | null;
      cfopReturnIntra?: string | null;
      cfopReturnInter?: string | null;
      cst?: string | null;
      cest?: string | null;
      icmsSt?: boolean;
      icmsOrigem?: string | null;
      icmsRates?: Record<string, number>;
    }) => upsertProductFiscal({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: FISCAL_READINESS_KEY });
      toast.success("Dados fiscais do produto salvos.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSuggestProductNcm() {
  return useMutation({
    mutationFn: (input: { productName: string; category?: string }) =>
      suggestProductNcmFn({ data: input }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertFiscalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      segment: string;
      name: string;
      defaultNcm?: string | null;
      cfopIntra?: string | null;
      cfopInter?: string | null;
      cfopReturnIntra?: string | null;
      cfopReturnInter?: string | null;
      defaultCst?: string | null;
      cest?: string | null;
      icmsSt?: boolean;
    }) => upsertFiscalTemplateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FISCAL_TEMPLATES_KEY });
      toast.success("Template fiscal salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyFiscalTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { templateId: string; productIds: string[] }) =>
      applyFiscalTemplateFn({ data: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: FISCAL_READINESS_KEY });
      toast.success(`Template aplicado em ${res.count} produto(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkImportProductFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => bulkImportProductFiscalFn({ data: { csv } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: PRODUCTS_KEY });
      qc.invalidateQueries({ queryKey: FISCAL_READINESS_KEY });
      toast.success(`${res.updated} produto(s) atualizados via CSV.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function previewChannelPrice(sku: string, channel: string) {
  return previewChannelPriceFn({ data: { sku, channel } });
}
