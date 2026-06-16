import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

import type { BacktestSeriesPayload } from './backtestSeries'

export async function fetchBacktestSeries(params: {
  file: string | null
  runId?: string | null
}): Promise<BacktestSeriesPayload | null> {
  const search = new URLSearchParams()
  if (params.file) search.set('file', params.file)
  if (params.runId) search.set('runId', params.runId)
  const query = search.toString()

  const response = await apiFetch(`${API_ENDPOINTS.alfaclub.backtestSeries}${query ? `?${query}` : ''}`, {
    method: 'GET',
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Failed to load backtest series (${response.status})`))
  }
  if (!payload?.success || !payload.data) return null
  return payload.data as BacktestSeriesPayload
}
