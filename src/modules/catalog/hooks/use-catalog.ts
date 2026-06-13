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
} from "../actions.functions";

export const PRODUCTS_KEY = ["products"] as const;
export const LISTINGS_KEY = ["channel-listings"] as const;
export const PRICING_RULES_KEY = ["pricing-rules"] as const;
export const STOCK_BUFFERS_KEY = ["stock-buffers"] as const;

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

export async function previewChannelPrice(sku: string, channel: string) {
  return previewChannelPriceFn({ data: { sku, channel } });
}
