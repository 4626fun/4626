const PRIVY_PASSWORDLESS_INIT_URL = 'https://auth.privy.io/api/v1/passwordless/init'
const PRIVY_CANONICAL_ORIGIN = 'https://auth.privy.io'
const PRIVY_LEGACY_CUSTOM_ORIGIN = 'https://privy.4626.fun'
const PRIVY_API_PATH_PREFIX = '/api/v1/'
const DEFAULT_PRIVY_PASSWORDLESS_FAILURE_BACKOFF_MS = 10_000
const DEFAULT_PRIVY_PASSWORDLESS_RATE_LIMIT_BACKOFF_MS = 30_000

export function getPrivyPasswordlessInitUrl(): string {
  return PRIVY_PASSWORDLESS_INIT_URL
}

export function normalizeFetchMethod(value: string | null | undefined): string {
  const method = String(value ?? '')
    .trim()
    .toUpperCase()
  return method || 'GET'
}

const PRIVY_PASSWORDLESS_INIT_PATH = '/api/v1/passwordless/init'
const PRIVY_PASSWORDLESS_INIT_HOSTS = ['auth.privy.io', 'privy.4626.fun']

export function isPrivyPasswordlessInitRequest(url: string, method: string): boolean {
  if (normalizeFetchMethod(method) !== 'POST') return false
  try {
    const parsed = new URL(url)
    return (
      parsed.pathname === PRIVY_PASSWORDLESS_INIT_PATH &&
      PRIVY_PASSWORDLESS_INIT_HOSTS.includes(parsed.hostname.toLowerCase())
    )
  } catch {
    return false
  }
}

export function rewritePrivyLegacyRequestUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.origin.toLowerCase() !== PRIVY_LEGACY_CUSTOM_ORIGIN) return url
    if (!parsed.pathname.startsWith(PRIVY_API_PATH_PREFIX)) return url
    parsed.protocol = 'https:'
    parsed.host = new URL(PRIVY_CANONICAL_ORIGIN).host
    return parsed.toString()
  } catch {
    return url
  }
}

export function rewritePrivyLegacyRequestInput(
  input: RequestInfo | URL,
  init?: RequestInit,
): {
  input: RequestInfo | URL
  init: RequestInit | undefined
  url: string
  rewritten: boolean
} {
  const originalUrl =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const rewrittenUrl = rewritePrivyLegacyRequestUrl(originalUrl)
  if (rewrittenUrl === originalUrl) {
    return { input, init, url: originalUrl, rewritten: false }
  }

  if (input instanceof Request) {
    return {
      input: new Request(rewrittenUrl, input),
      init,
      url: rewrittenUrl,
      rewritten: true,
    }
  }

  return {
    input: rewrittenUrl,
    init,
    url: rewrittenUrl,
    rewritten: true,
  }
}

export function getPrivyPasswordlessBackoffMs(response: Response | { headers?: Pick<Headers, 'get'> }): number {
  const raw = response.headers?.get('retry-after')?.trim() ?? ''
  if (!raw) return DEFAULT_PRIVY_PASSWORDLESS_RATE_LIMIT_BACKOFF_MS

  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(1_000, Math.round(seconds * 1_000))
  }

  const timestamp = Date.parse(raw)
  if (Number.isFinite(timestamp)) {
    return Math.max(1_000, timestamp - Date.now())
  }

  return DEFAULT_PRIVY_PASSWORDLESS_RATE_LIMIT_BACKOFF_MS
}

export function isPrivyPasswordlessFailure(error: unknown): boolean {
  const text =
    typeof error === 'string'
      ? error
      : typeof (error as { message?: unknown } | null)?.message === 'string'
        ? String((error as any).message)
        : ''
  const normalized = text.trim().toLowerCase()
  return (
    normalized.includes('429') ||
    normalized.includes('1015') ||
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('blocked by cors') ||
    normalized.includes('access-control-allow-origin')
  )
}

export function getPrivyPasswordlessFailureBackoffMs(): number {
  return DEFAULT_PRIVY_PASSWORDLESS_FAILURE_BACKOFF_MS
}
