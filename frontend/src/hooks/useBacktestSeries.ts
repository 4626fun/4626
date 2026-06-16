import { useQuery } from '@tanstack/react-query'

import { fetchBacktestSeries } from '@/lib/alfaclub/backtestSeriesFetch'

export function useBacktestSeries(params: { file: string | null; runId: string | null }) {
  return useQuery({
    queryKey: ['backtest-series', params.file, params.runId],
    queryFn: () => fetchBacktestSeries(params),
    enabled: Boolean(params.file),
    staleTime: 30_000,
  })
}
