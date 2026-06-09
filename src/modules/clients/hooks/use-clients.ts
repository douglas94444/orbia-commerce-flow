import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listClients,
  getPortfolioStats,
  createClient,
  getClient,
  type CreateClientInput,
} from "../actions.functions";

export const CLIENTS_QUERY_KEY = ["clients"] as const;
export const PORTFOLIO_STATS_KEY = ["portfolio-stats"] as const;
export const CLIENT_DETAIL_KEY = (id: string) => ["client", id] as const;

// ─── Queries ──────────────────────────────────────────────────

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: () => listClients(),
    staleTime: 30_000, // 30s — clients data changes infrequently
  });
}

export function useClientDetail(id: string) {
  return useQuery({
    queryKey: CLIENT_DETAIL_KEY(id),
    queryFn: () => getClient({ data: { id } }),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function usePortfolioStats() {
  return useQuery({
    queryKey: PORTFOLIO_STATS_KEY,
    queryFn: () => getPortfolioStats(),
    staleTime: 60_000, // 1min
  });
}

// ─── Mutations ────────────────────────────────────────────────

export function useCreateClient(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateClientInput) => createClient({ data: input }),
    onSuccess: (newClient) => {
      // Optimistic cache update — prepend new client and refetch
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PORTFOLIO_STATS_KEY });
      toast.success(`Cliente "${newClient.name}" criado com sucesso.`);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
