import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listChannelListings,
  listProducts,
  syncAllCatalogsFn,
  syncClientCatalog,
} from "../actions.functions";

export const PRODUCTS_KEY = ["products"] as const;
export const LISTINGS_KEY = ["channel-listings"] as const;

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
    },
  });
}
