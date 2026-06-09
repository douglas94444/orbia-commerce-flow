import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAtRiskClients,
  getOnboardingPipeline,
  getSuccessPortfolio,
  listClientActivities,
  listClientOnboardingTasks,
  logCsActivity,
  recordNps,
  resolveOperationAlert,
  toggleOnboardingTask,
} from "../actions.functions";
import { ALERTS_KEY } from "@/modules/analytics/hooks/use-analytics";

export const SUCCESS_PORTFOLIO_KEY = ["success-portfolio"] as const;
export const ONBOARDING_PIPELINE_KEY = ["onboarding-pipeline"] as const;
export const AT_RISK_CLIENTS_KEY = ["at-risk-clients"] as const;

export function useSuccessPortfolio(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: SUCCESS_PORTFOLIO_KEY,
    queryFn: () => getSuccessPortfolio(),
    staleTime: 60_000,
    enabled: options?.enabled !== false,
  });
}

export function useOnboardingPipeline() {
  return useQuery({
    queryKey: ONBOARDING_PIPELINE_KEY,
    queryFn: () => getOnboardingPipeline(),
    staleTime: 60_000,
  });
}

export function useAtRiskClients() {
  return useQuery({
    queryKey: AT_RISK_CLIENTS_KEY,
    queryFn: () => getAtRiskClients(),
    staleTime: 60_000,
  });
}

export function useClientActivities(clientId: string) {
  return useQuery({
    queryKey: ["client-activities", clientId],
    queryFn: () => listClientActivities({ data: { clientId } }),
    staleTime: 30_000,
  });
}

export function useClientOnboardingTasks(clientId: string) {
  return useQuery({
    queryKey: ["client-onboarding-tasks", clientId],
    queryFn: () => listClientOnboardingTasks({ data: { clientId } }),
    staleTime: 30_000,
  });
}

export function useLogCsActivity(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: "contact" | "qbr" | "onboarding_note";
      channel?: "call" | "email" | "whatsapp" | "meeting";
      notes?: string;
    }) => logCsActivity({ data: { clientId, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-activities", clientId] });
      qc.invalidateQueries({ queryKey: SUCCESS_PORTFOLIO_KEY });
      toast.success("Atividade registrada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecordNps(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { score: number; notes?: string }) =>
      recordNps({ data: { clientId, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUCCESS_PORTFOLIO_KEY });
      toast.success("NPS registrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleOnboardingTask(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskId: string; isDone: boolean }) =>
      toggleOnboardingTask({ data: { clientId, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-onboarding-tasks", clientId] });
      qc.invalidateQueries({ queryKey: ONBOARDING_PIPELINE_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveOperationAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => resolveOperationAlert({ data: { alertId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ALERTS_KEY });
      qc.invalidateQueries({ queryKey: SUCCESS_PORTFOLIO_KEY });
      toast.success("Alerta resolvido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
