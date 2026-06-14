import { useQuery } from '@tanstack/react-query'
import { fetchBacktestSweep, type BacktestSweepPayload } from '@/lib/alfaclub/backtestSweep'

export function useBacktestSweep(params?: { file?: string | null; enabled?: boolean }) {
  const query = useQuery<BacktestSweepPayload>({
    queryKey: ['alfaclub', 'backtest-sweep', params?.file ?? null],
    queryFn: () => fetchBacktestSweep({ file: params?.file ?? null }),
    enabled: params?.enabled ?? true,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
