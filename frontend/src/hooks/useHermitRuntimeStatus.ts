import { useQuery } from '@tanstack/react-query'
import {
  fetchHermitRuntimeStatus,
  type HermitRuntimeStatusPayload,
} from '@/lib/alfaclub/hermitRuntimeStatus'

export function useHermitRuntimeStatus(params?: { enabled?: boolean; limit?: number }) {
  const limit = params?.limit ?? 25
  const query = useQuery<HermitRuntimeStatusPayload>({
    queryKey: ['alfaclub', 'hermit', 'runtime-status', limit],
    queryFn: () => fetchHermitRuntimeStatus(limit),
    enabled: params?.enabled ?? true,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
