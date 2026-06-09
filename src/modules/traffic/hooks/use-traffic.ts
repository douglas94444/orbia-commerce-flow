import { useQuery } from '@tanstack/react-query'
import { listCampaigns, getTrafficStats } from '../actions.functions'

export const CAMPAIGNS_KEY     = ['campaigns'] as const
export const TRAFFIC_STATS_KEY = ['traffic-stats'] as const

export function useCampaigns() {
  return useQuery({ queryKey: CAMPAIGNS_KEY, queryFn: () => listCampaigns(), staleTime: 30_000 })
}

export function useTrafficStats() {
  return useQuery({ queryKey: TRAFFIC_STATS_KEY, queryFn: () => getTrafficStats(), staleTime: 30_000 })
}
