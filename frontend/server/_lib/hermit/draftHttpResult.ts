export type DraftHttpFailureClass =
  | 'network'
  | 'timeout'
  | 'client_error'
  | 'rate_limit'
  | 'server_error'
  | 'empty_body'

export type DraftHttpResult =
  | { ok: true; text: string }
  | { ok: false; failureClass: DraftHttpFailureClass; status?: number }

export function isRetryableDraftFailure(failureClass: DraftHttpFailureClass): boolean {
  switch (failureClass) {
    case 'server_error':
    case 'network':
    case 'timeout':
    case 'empty_body':
      return true
    case 'client_error':
    case 'rate_limit':
      return false
    default: {
      const exhaustive: never = failureClass
      return exhaustive
    }
  }
}

export function classifyDraftHttpStatus(status: number): DraftHttpFailureClass {
  if (status === 429) return 'rate_limit'
  if (status === 401 || status === 400 || status === 403) return 'client_error'
  if (status === 502 || status === 503 || status === 504) return 'server_error'
  return 'client_error'
}

export function classifyDraftFetchError(error: unknown): DraftHttpFailureClass {
  const name = typeof (error as { name?: unknown })?.name === 'string' ? (error as { name: string }).name : ''
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout'
  return 'network'
}
