import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNfEmissions,
  getFiscalStats,
  getFiscalConfig,
  upsertFiscalConfig,
  uploadFiscalCertificate,
  type FiscalConfigInput,
} from "../actions.functions";

export const NF_EMISSIONS_KEY = ["nf-emissions"] as const;
export const FISCAL_STATS_KEY = ["fiscal-stats"] as const;
export const FISCAL_CONFIG_KEY = ["fiscal-config"] as const;

export function useNfEmissions() {
  return useQuery({
    queryKey: NF_EMISSIONS_KEY,
    queryFn: () => listNfEmissions(),
    staleTime: 10_000,
  });
}

export function useFiscalStats() {
  return useQuery({
    queryKey: FISCAL_STATS_KEY,
    queryFn: () => getFiscalStats(),
    staleTime: 15_000,
  });
}

export function useFiscalConfig() {
  return useQuery({
    queryKey: FISCAL_CONFIG_KEY,
    queryFn: () => getFiscalConfig(),
    staleTime: 60_000,
  });
}

export function useUpsertFiscalConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FiscalConfigInput) => upsertFiscalConfig({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_CONFIG_KEY });
      toast.success("Configuração fiscal salva com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUploadFiscalCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { fileBase64: string; fileName: string }) =>
      uploadFiscalCertificate({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_CONFIG_KEY });
      toast.success("Certificado A1 enviado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
