import { useQuery } from '@tanstack/react-query'

import { fetchBacktestAudit } from '@/lib/alfaclub/backtestAudit'

export function useBacktestAudit(params: { file?: string | null; runId?: string | null }) {
  const enabled = Boolean(params.file && params.runId)
  return useQuery({
    queryKey: ['alfaclub', 'backtest-audit', params.file ?? null, params.runId ?? null],
    queryFn: () => fetchBacktestAudit(params),
    enabled,
    staleTime: 15_000,
  })
}
