import { useQuery } from '@tanstack/react-query'
import { listNfEmissions, getFiscalStats } from '../actions.functions'

export const NF_EMISSIONS_KEY = ['nf-emissions'] as const
export const FISCAL_STATS_KEY = ['fiscal-stats'] as const

export function useNfEmissions() {
  return useQuery({ queryKey: NF_EMISSIONS_KEY, queryFn: () => listNfEmissions(), staleTime: 10_000 })
}

export function useFiscalStats() {
  return useQuery({ queryKey: FISCAL_STATS_KEY, queryFn: () => getFiscalStats(), staleTime: 15_000 })
}
