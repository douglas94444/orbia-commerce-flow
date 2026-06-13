import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listSacInbox,
  getSacTicket,
  assignSacTicket,
  replySacMessage,
  changeSacStatus,
  mergeSacTickets,
  listSacQuickReplies,
  upsertSacQuickReply,
  addSacInternalNote,
  suggestSacReplyFn,
  createSacReturn,
  replyMlFromSac,
  getSacMetrics,
  listSacKnowledge,
  upsertSacKnowledge,
  getSacReviewSummary,
} from "../actions.functions";

export function useSacInbox() {
  return useQuery({ queryKey: ["sac-inbox"], queryFn: () => listSacInbox() });
}

export function useSacTicket(ticketId: string) {
  return useQuery({
    queryKey: ["sac-ticket", ticketId],
    queryFn: () => getSacTicket({ data: { ticketId } }),
    enabled: !!ticketId,
  });
}

export function useAssignSacTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => assignSacTicket({ data: { ticketId } }),
    onSuccess: (_, ticketId) => {
      qc.invalidateQueries({ queryKey: ["sac-inbox"] });
      qc.invalidateQueries({ queryKey: ["sac-ticket", ticketId] });
      toast.success("Ticket atribuído a você");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReplySacMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; conversationId: string; body: string }) =>
      replySacMessage({ data: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sac-ticket", vars.ticketId] });
      qc.invalidateQueries({ queryKey: ["sac-inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangeSacStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ticketId: string;
      status: "open" | "in_progress" | "waiting_customer" | "resolved" | "closed";
    }) => changeSacStatus({ data: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sac-ticket", vars.ticketId] });
      qc.invalidateQueries({ queryKey: ["sac-inbox"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMergeSacTickets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { sourceTicketId: string; targetTicketId: string }) =>
      mergeSacTickets({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sac-inbox"] });
      toast.success("Tickets mesclados");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSacQuickReplies() {
  return useQuery({ queryKey: ["sac-quick-replies"], queryFn: () => listSacQuickReplies() });
}

export function useUpsertSacQuickReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; title: string; body: string; category?: string }) =>
      upsertSacQuickReply({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sac-quick-replies"] });
      toast.success("Resposta rápida salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSacInternalNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; body: string }) =>
      addSacInternalNote({ data: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sac-ticket", vars.ticketId] });
      toast.success("Nota interna adicionada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSuggestSacReply() {
  return useMutation({
    mutationFn: (ticketId: string) => suggestSacReplyFn({ data: { ticketId } }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateSacReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ticketId: string;
      orderId: string;
      reason: string;
      items: Array<{ sku: string; qty: number }>;
    }) => createSacReturn({ data: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sac-ticket", vars.ticketId] });
      toast.success("Devolução aberta");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReplyMlFromSac() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ticketId: string;
      claimId: string;
      body: string;
      type: "question" | "claim";
    }) => replyMlFromSac({ data: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sac-ticket", vars.ticketId] });
      toast.success("Resposta enviada ao Mercado Livre");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSacMetrics(days = 30) {
  return useQuery({
    queryKey: ["sac-metrics", days],
    queryFn: () => getSacMetrics({ data: { days } }),
  });
}

export function useSacKnowledge() {
  return useQuery({ queryKey: ["sac-knowledge"], queryFn: () => listSacKnowledge() });
}

export function useUpsertSacKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      slug: string;
      title: string;
      body: string;
      category?: string;
      isPublic?: boolean;
      botEnabled?: boolean;
    }) => upsertSacKnowledge({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sac-knowledge"] });
      toast.success("Artigo salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSacReviewSummary() {
  return useQuery({ queryKey: ["sac-reviews"], queryFn: () => getSacReviewSummary() });
}
