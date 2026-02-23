export type PreprovisionUiStatus = 'idle' | 'loading' | 'done' | 'error'

type ClassifyInput = {
  httpStatus: number
  json?: { success?: boolean; data?: unknown } | null
}

/**
 * Classifies a preprovision API response into a UI status.
 * - 401/403/404: treated as 'idle' (quiet, no card shown)
 * - 200 + success + data: 'done'
 * - Other (e.g. 500): 'error'
 */
export function classifyPreprovisionResponse({ httpStatus, json }: ClassifyInput): PreprovisionUiStatus {
  if (json?.success === true && json?.data != null) {
    return 'done'
  }
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 404) {
    return 'idle'
  }
  return 'error'
}
