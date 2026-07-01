import { useQuery } from '@tanstack/react-query'
import {
  fetchCounterTradeStatus,
  isCounterTradeStatusAuthError,
  type CounterTradeStatusPayload,
} from '@/lib/alfaclub/counterTradeStatus'

export function useCounterTradeStatus(params?: { enabled?: boolean; refetchIntervalMs?: number }) {
  const refetchIntervalMs = params?.refetchIntervalMs
  const query = useQuery<CounterTradeStatusPayload>({
    queryKey: ['alfaclub', 'counter-trade', 'status'],
    queryFn: fetchCounterTradeStatus,
    enabled: params?.enabled ?? true,
    staleTime: 30_000,
    refetchInterval: refetchIntervalMs != null && refetchIntervalMs > 0 ? refetchIntervalMs : false,
    retry: (failureCount, error) => {
      if (isCounterTradeStatusAuthError(error)) return false
      return failureCount < 1
    },
    refetchOnWindowFocus: refetchIntervalMs != null && refetchIntervalMs > 0,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    isAuthRequired: isCounterTradeStatusAuthError(query.error),
    refetch: query.refetch,
  }
}

