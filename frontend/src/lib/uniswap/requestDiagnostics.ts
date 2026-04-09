export type UniswapRequestFailureCode =
  | 'auth-required'
  | 'forbidden'
  | 'rate-limited'
  | 'not-configured'
  | 'http-error'
  | 'network-error'

export type UniswapRequestFailure = {
  code: UniswapRequestFailureCode
  status: number | null
  message: string
}

const WARN_DEDUPE_WINDOW_MS = 30_000
const recentWarnings = new Map<string, number>()

export function classifyUniswapRequestFailure(status: number | null): UniswapRequestFailure {
  if (status === 401) {
    return {
      code: 'auth-required',
      status,
      message: 'Sign in to load Uniswap data.',
    }
  }
  if (status === 403) {
    return {
      code: 'forbidden',
      status,
      message: 'Request was blocked by origin or session policy.',
    }
  }
  if (status === 429) {
    return {
      code: 'rate-limited',
      status,
      message: 'Uniswap data is rate limited right now.',
    }
  }
  if (status === 503) {
    return {
      code: 'not-configured',
      status,
      message: 'Uniswap data service is not configured.',
    }
  }
  if (typeof status === 'number') {
    return {
      code: 'http-error',
      status,
      message: `Uniswap data request failed (${status}).`,
    }
  }
  return {
    code: 'network-error',
    status: null,
    message: 'Uniswap data request failed due to a network error.',
  }
}

export function warnUniswapRequestOnce(params: {
  scope: string
  failure: UniswapRequestFailure
  detail?: string | null
}) {
  const detail = typeof params.detail === 'string' ? params.detail.trim() : ''
  const key = `${params.scope}:${params.failure.code}:${params.failure.status ?? 'na'}:${detail}`
  const now = Date.now()
  const previous = recentWarnings.get(key)
  if (typeof previous === 'number' && now - previous < WARN_DEDUPE_WINDOW_MS) return
  recentWarnings.set(key, now)
  console.warn(`[uniswap/${params.scope}] ${params.failure.message}`, {
    status: params.failure.status,
    code: params.failure.code,
    ...(detail ? { detail } : null),
  })
}

export function extractGraphqlOperationName(query: string): string | null {
  if (typeof query !== 'string') return null
  const match = query.match(/^\s*query\s+([_A-Za-z][_0-9A-Za-z]*)\b/)
  return match?.[1] ?? null
}
