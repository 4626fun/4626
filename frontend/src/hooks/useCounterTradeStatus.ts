import { useQuery } from '@tanstack/react-query'
import {
  fetchCounterTradeStatus,
  isCounterTradeStatusAuthError,
  type CounterTradeStatusPayload,
} from '@/lib/alfaclub/counterTradeStatus'

export function useCounterTradeStatus(params?: { enabled?: boolean }) {
  const query = useQuery<CounterTradeStatusPayload>({
    queryKey: ['alfaclub', 'counter-trade', 'status'],
    queryFn: fetchCounterTradeStatus,
    enabled: params?.enabled ?? true,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (isCounterTradeStatusAuthError(error)) return false
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    isAuthRequired: isCounterTradeStatusAuthError(query.error),
    refetch: query.refetch,
  }
}

