import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNfEmissions,
  getNfeEmissionDetail,
  getFiscalStats,
  getFiscalConfig,
  upsertFiscalConfig,
  uploadFiscalCertificate,
  getFiscalReadiness,
  retryNfeEmissionFn,
  cancelNfeEmissionFn,
  exportNfePeriodCsv,
  cartaCorrecaoNfeFn,
  inutilizarNumeracaoFn,
  emitNfceForOrderFn,
  emitNfseForOrderFn,
  emitNfeForOrderFn,
  listOrdersAwaitingNf,
  getNfeXmlDownloadUrl,
  listNfeFiscalEventsFn,
  type FiscalConfigInput,
} from "../actions.functions";

export const NF_EMISSIONS_KEY = ["nf-emissions"] as const;
export const NF_EMISSION_DETAIL_KEY = ["nf-emission-detail"] as const;
export const FISCAL_STATS_KEY = ["fiscal-stats"] as const;
export const FISCAL_CONFIG_KEY = ["fiscal-config"] as const;
export const ORDERS_AWAITING_NF_KEY = ["orders-awaiting-nf"] as const;
export const NFE_FISCAL_EVENTS_KEY = ["nfe-fiscal-events"] as const;

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

export const FISCAL_READINESS_KEY = ["fiscal-readiness"] as const;

export function useFiscalReadiness() {
  return useQuery({
    queryKey: FISCAL_READINESS_KEY,
    queryFn: () => getFiscalReadiness(),
    staleTime: 30_000,
  });
}

export function useUpsertFiscalConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FiscalConfigInput) => upsertFiscalConfig({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_CONFIG_KEY });
      queryClient.invalidateQueries({ queryKey: FISCAL_READINESS_KEY });
      queryClient.invalidateQueries({ queryKey: FISCAL_STATS_KEY });
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
      queryClient.invalidateQueries({ queryKey: FISCAL_READINESS_KEY });
      queryClient.invalidateQueries({ queryKey: FISCAL_STATS_KEY });
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

export function useCartaCorrecaoNfe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { emissionId: string; correcao: string }) =>
      cartaCorrecaoNfeFn({ data: input }),
    onSuccess: () => {
      toast.success("Carta de Correção enviada");
      void queryClient.invalidateQueries({ queryKey: NF_EMISSION_DETAIL_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInutilizarNumeracao() {
  return useMutation({
    mutationFn: (input: {
      serie: string;
      numeroInicial: number;
      numeroFinal: number;
      justificativa: string;
    }) => inutilizarNumeracaoFn({ data: input }),
    onSuccess: () => toast.success("Numeração inutilizada com sucesso"),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useEmitNfce() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => emitNfceForOrderFn({ data: { orderId } }),
    onSuccess: () => {
      toast.success("NFC-e emitida com sucesso");
      void queryClient.invalidateQueries({ queryKey: NF_EMISSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: FISCAL_STATS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useEmitNfse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; serviceDescription?: string }) =>
      emitNfseForOrderFn({ data: input }),
    onSuccess: () => {
      toast.success("NFS-e emitida com sucesso");
      void queryClient.invalidateQueries({ queryKey: NF_EMISSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: FISCAL_STATS_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useEmitNfeForOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => emitNfeForOrderFn({ data: { orderId } }),
    onSuccess: () => {
      toast.success("NF-e emitida com sucesso");
      void queryClient.invalidateQueries({ queryKey: NF_EMISSIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: FISCAL_STATS_KEY });
      void queryClient.invalidateQueries({ queryKey: ORDERS_AWAITING_NF_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useOrdersAwaitingNf() {
  return useQuery({
    queryKey: ORDERS_AWAITING_NF_KEY,
    queryFn: () => listOrdersAwaitingNf(),
    staleTime: 15_000,
  });
}

export function useNfeFiscalEvents(emissionId: string) {
  return useQuery({
    queryKey: [...NFE_FISCAL_EVENTS_KEY, emissionId],
    queryFn: () => listNfeFiscalEventsFn({ data: { emissionId } }),
    enabled: Boolean(emissionId),
    staleTime: 30_000,
  });
}

export function useNfeXmlDownload() {
  return useMutation({
    mutationFn: (emissionId: string) => getNfeXmlDownloadUrl({ data: { emissionId } }),
    onError: (err: Error) => toast.error(err.message),
  });
}
