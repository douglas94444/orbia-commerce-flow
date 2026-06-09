import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  listSubscriptions,
  getMrrStats,
  listTransactions,
  createSubscription,
} from '../actions.functions'

export const SUBSCRIPTIONS_KEY = ['subscriptions'] as const
export const MRR_STATS_KEY     = ['mrr-stats'] as const
export const TRANSACTIONS_KEY  = ['transactions'] as const

// Mirror the zod schema shape used in createSubscription server function
interface CreateSubInput {
  clientId:      string
  plan:          'launch' | 'growth' | 'scale'
  provider?:     'stripe' | 'pagar_me' | 'manual'
  providerSubId?: string
}

export function useSubscriptions() {
  return useQuery({ queryKey: SUBSCRIPTIONS_KEY, queryFn: () => listSubscriptions(), staleTime: 60_000 })
}

export function useMrrStats() {
  return useQuery({ queryKey: MRR_STATS_KEY, queryFn: () => getMrrStats(), staleTime: 60_000 })
}

export function useTransactions() {
  return useQuery({ queryKey: TRANSACTIONS_KEY, queryFn: () => listTransactions(), staleTime: 30_000 })
}

export function useCreateSubscription(onSuccess?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSubInput) => createSubscription({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY })
      qc.invalidateQueries({ queryKey: MRR_STATS_KEY })
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['portfolio-stats'] })
      toast.success('Assinatura criada com sucesso.')
      onSuccess?.()
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
