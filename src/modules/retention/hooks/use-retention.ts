import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listAutomations,
  getRetentionStats,
  toggleAutomation,
  getLtvAnalytics,
  getTemplateLibrary,
  getWhatsAppTemplates,
  simulateAutomation,
  applyTemplateFromLibrary,
  updateQuietHours,
  getAutomationFlow,
  getCohortRetention,
  getMessageDeliveryLog,
  getLoyaltySummary,
  redeemLoyaltyPoints,
  registerDeviceToken,
  listAbExperiments,
  createAbExperiment,
  syncWhatsAppTemplatesAction,
  updateWhatsAppProvider,
} from "../actions.functions";

export const AUTOMATIONS_KEY = ["automations"] as const;
export const RETENTION_STATS_KEY = ["retention-stats"] as const;
export const LTV_ANALYTICS_KEY = ["ltv-analytics"] as const;
export const TEMPLATE_LIBRARY_KEY = ["template-library"] as const;
export const COHORT_KEY = ["cohort-retention"] as const;
export const MESSAGE_LOG_KEY = ["message-delivery-log"] as const;
export const LOYALTY_KEY = ["loyalty-summary"] as const;
export const AB_EXPERIMENTS_KEY = ["ab-experiments"] as const;

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

export function useLtvAnalytics() {
  return useQuery({
    queryKey: LTV_ANALYTICS_KEY,
    queryFn: () => getLtvAnalytics(),
    staleTime: 120_000,
  });
}

export function useTemplateLibrary() {
  return useQuery({
    queryKey: TEMPLATE_LIBRARY_KEY,
    queryFn: () => getTemplateLibrary(),
    staleTime: 300_000,
  });
}

export function useCohortRetention() {
  return useQuery({
    queryKey: COHORT_KEY,
    queryFn: () => getCohortRetention(),
    staleTime: 120_000,
  });
}

export function useMessageDeliveryLog(filters?: { channel?: string; status?: string }) {
  return useQuery({
    queryKey: [...MESSAGE_LOG_KEY, filters],
    queryFn: () => getMessageDeliveryLog({ data: filters }),
    staleTime: 30_000,
  });
}

export function useLoyaltySummary() {
  return useQuery({
    queryKey: LOYALTY_KEY,
    queryFn: () => getLoyaltySummary(),
    staleTime: 60_000,
  });
}

export function useAbExperiments() {
  return useQuery({
    queryKey: AB_EXPERIMENTS_KEY,
    queryFn: () => listAbExperiments(),
    staleTime: 60_000,
  });
}

export function useAutomationFlow(sequenceId: string | null) {
  return useQuery({
    queryKey: ["automation-flow", sequenceId],
    queryFn: () => getAutomationFlow({ data: { sequenceId: sequenceId! } }),
    enabled: !!sequenceId,
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

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: () => getWhatsAppTemplates(),
    staleTime: 60_000,
  });
}

export function useSimulateAutomation() {
  return useMutation({
    mutationFn: (trigger: string) => simulateAutomation({ data: { trigger } }),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { templateId: string; sequenceName?: string }) =>
      applyTemplateFromLibrary({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY });
      toast.success("Template aplicado como novo fluxo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateQuietHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { quietHoursStart: number; quietHoursEnd: number }) =>
      updateQuietHours({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AUTOMATIONS_KEY });
      toast.success("Horário de envio atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRedeemLoyalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { customerId: string; points: number }) =>
      redeemLoyaltyPoints({ data: vars }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: LOYALTY_KEY });
      toast.success(`Cupom gerado: ${data.couponCode}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRegisterDeviceToken() {
  return useMutation({
    mutationFn: (vars: { token: string; platform?: "web" | "ios" | "android"; customerId?: string }) =>
      registerDeviceToken({ data: { token: vars.token, platform: vars.platform ?? "web", customerId: vars.customerId } }),
    onSuccess: () => toast.success("Token push registrado."),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateAbExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { stepId: string; variantAKey: string; variantBKey: string; trafficSplit?: number }) =>
      createAbExperiment({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AB_EXPERIMENTS_KEY });
      toast.success("Experimento A/B criado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSyncWhatsAppTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncWhatsAppTemplatesAction(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success(`${data.synced} templates sincronizados.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateWhatsAppProvider() {
  return useMutation({
    mutationFn: (provider: "meta" | "evolution") => updateWhatsAppProvider({ data: { provider } }),
    onSuccess: () => toast.success("Provedor WhatsApp atualizado."),
    onError: (e: Error) => toast.error(e.message),
  });
}
