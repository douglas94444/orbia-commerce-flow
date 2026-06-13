import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNfEmissions,
  getNfeEmissionDetail,
  getFiscalStats,
  getFiscalConfig,
  upsertFiscalConfig,
  uploadFiscalCertificate,
  retryNfeEmissionFn,
  cancelNfeEmissionFn,
  exportNfePeriodCsv,
  type FiscalConfigInput,
} from "../actions.functions";

export const NF_EMISSIONS_KEY = ["nf-emissions"] as const;
export const NF_EMISSION_DETAIL_KEY = ["nf-emission-detail"] as const;
export const FISCAL_STATS_KEY = ["fiscal-stats"] as const;
export const FISCAL_CONFIG_KEY = ["fiscal-config"] as const;

export function useNfEmissions() {
  return useQuery({
    queryKey: NF_EMISSIONS_KEY,
    queryFn: () => listNfEmissions(),
    staleTime: 10_000,
  });
}

export function useNfeEmissionDetail(emissionId: string) {
  return useQuery({
    queryKey: [...NF_EMISSION_DETAIL_KEY, emissionId],
    queryFn: () => getNfeEmissionDetail({ data: { emissionId } }),
    enabled: Boolean(emissionId),
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
    mutationFn: (input: {
      fileBase64: string;
      fileName: string;
      certPassword?: string;
      certExpiresAt?: string;
    }) => uploadFiscalCertificate({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_CONFIG_KEY });
      toast.success("Certificado A1 enviado com sucesso.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRetryNfeEmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emissionId: string) => retryNfeEmissionFn({ data: { emissionId } }),
    onSuccess: () => {
      toast.success("NF reprocessada com sucesso");
      void queryClient.invalidateQueries({ queryKey: NF_EMISSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: FISCAL_STATS_KEY });
      void queryClient.invalidateQueries({ queryKey: NF_EMISSION_DETAIL_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelNfeEmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { emissionId: string; justificativa: string }) =>
      cancelNfeEmissionFn({ data: input }),
    onSuccess: () => {
      toast.success("NF cancelada com sucesso");
      void queryClient.invalidateQueries({ queryKey: NF_EMISSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: FISCAL_STATS_KEY });
      void queryClient.invalidateQueries({ queryKey: NF_EMISSION_DETAIL_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useExportNfePeriodCsv() {
  return useMutation({
    mutationFn: (days?: number) => exportNfePeriodCsv({ data: { days } }),
    onError: (err: Error) => toast.error(err.message),
  });
}
