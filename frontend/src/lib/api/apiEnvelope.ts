export type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
  reason?: string
  message?: string
  details?: unknown
}

export function resolveApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string') {
    const message = ((payload as { error: string }).error || '').trim()
    if (message) return message
  }
  return fallback
}

export async function parseApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  return (await response.json().catch(() => null)) as ApiEnvelope<T> | null
}
