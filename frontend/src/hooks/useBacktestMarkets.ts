import { useQuery } from '@tanstack/react-query'

import { fetchBacktestMarkets } from '@/lib/alfaclub/backtestMarkets'

export function useBacktestMarkets() {
  return useQuery({
    queryKey: ['alfaclub', 'backtest-markets'],
    queryFn: () => fetchBacktestMarkets(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  })
}
