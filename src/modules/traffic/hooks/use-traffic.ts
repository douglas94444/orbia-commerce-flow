import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listCampaigns,
  getTrafficStats,
  syncAllMetaCampaigns,
  syncAllGoogleCampaigns,
} from "../actions.functions";

export const CAMPAIGNS_KEY = ["campaigns"] as const;
export const TRAFFIC_STATS_KEY = ["traffic-stats"] as const;

export function useCampaigns() {
  return useQuery({ queryKey: CAMPAIGNS_KEY, queryFn: () => listCampaigns(), staleTime: 30_000 });
}

export function useTrafficStats() {
  return useQuery({
    queryKey: TRAFFIC_STATS_KEY,
    queryFn: () => getTrafficStats(),
    staleTime: 30_000,
  });
}

export function useSyncMetaCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncAllMetaCampaigns(),
    onSuccess: (result) => {
      toast.success(`${result.synced} campanha(s) Meta em ${result.clients} conta(s)`);
      void qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      void qc.invalidateQueries({ queryKey: TRAFFIC_STATS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSyncGoogleCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncAllGoogleCampaigns(),
    onSuccess: (result) => {
      toast.success(`${result.synced} campanha(s) Google em ${result.clients} conta(s)`);
      void qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      void qc.invalidateQueries({ queryKey: TRAFFIC_STATS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
