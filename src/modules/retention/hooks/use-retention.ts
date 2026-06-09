import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listAutomations, getRetentionStats, toggleAutomation } from "../actions.functions";

export const AUTOMATIONS_KEY = ["automations"] as const;
export const RETENTION_STATS_KEY = ["retention-stats"] as const;

export function useAutomations() {
  return useQuery({
    queryKey: AUTOMATIONS_KEY,
    queryFn: () => listAutomations(),
    staleTime: 30_000,
  });
}

export function useRetentionStats() {
  return useQuery({
    queryKey: RETENTION_STATS_KEY,
    queryFn: () => getRetentionStats(),
    staleTime: 60_000,
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => toggleAutomation({ data: vars }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY });
      toast.success(vars.active ? "Automação ativada." : "Automação pausada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
