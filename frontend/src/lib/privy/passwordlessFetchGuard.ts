const PRIVY_PASSWORDLESS_INIT_URL = 'https://auth.privy.io/api/v1/passwordless/init'
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

export function isPrivyPasswordlessInitRequest(url: string, method: string): boolean {
  if (normalizeFetchMethod(method) !== 'POST') return false
  try {
    return new URL(url).toString() === PRIVY_PASSWORDLESS_INIT_URL
  } catch {
    return false
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
