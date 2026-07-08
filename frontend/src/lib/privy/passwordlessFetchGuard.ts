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
const PRIVY_APP_CONFIG_PATH = /^\/api\/v1\/apps\/[^/]+$/
const PRIVY_SESSIONS_PATH = '/api/v1/sessions'
const PRIVY_SIWE_LINK_PATH = '/api/v1/siwe/link'
const PRIVY_SIWE_UNLINK_PATH = '/api/v1/siwe/unlink'
const PRIVY_OAUTH_LINK_PATH = '/api/v1/oauth/link'
const PRIVY_OAUTH_UNLINK_PATH = '/api/v1/oauth/unlink'
const PRIVY_PRIVY_IO_HOSTS = ['auth.privy.io', 'privy.4626.fun']
const PRIVY_DEPRECATED_REFRESH_TOKEN = 'deprecated'

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

export function isPrivyDeprecatedSessionRefreshRequest(
  url: string,
  method: string,
  bodyText: string | null | undefined,
): boolean {
  if (normalizeFetchMethod(method) !== 'POST') return false
  try {
    const parsed = new URL(url)
    if (!PRIVY_PRIVY_IO_HOSTS.includes(parsed.hostname.toLowerCase())) return false
    if (parsed.pathname !== PRIVY_SESSIONS_PATH) return false
    if (!bodyText) return false
    const json = JSON.parse(bodyText) as { refresh_token?: unknown }
    return json?.refresh_token === PRIVY_DEPRECATED_REFRESH_TOKEN
  } catch {
    return false
  }
}

/**
 * Privy's own SDK submits the signed SIWE message to link or unlink an
 * additional wallet here (`unlinkWallet()` on the client hits `siwe/unlink`,
 * mirroring `siwe/link` for linking). Both require a live access token; on
 * local dev's `custom_api_url` loopback (see privyLoopbackFetchRewrite.ts)
 * that token can go stale mid-session with no way to silently refresh it, so
 * these 401 repeatedly until the stale session is reset.
 */
export function isPrivySiweLinkOrUnlinkRequest(url: string, method: string): boolean {
  if (normalizeFetchMethod(method) !== 'POST') return false
  try {
    const parsed = new URL(url)
    if (!PRIVY_PRIVY_IO_HOSTS.includes(parsed.hostname.toLowerCase())) return false
    return parsed.pathname === PRIVY_SIWE_LINK_PATH || parsed.pathname === PRIVY_SIWE_UNLINK_PATH
  } catch {
    return false
  }
}

/**
 * Privy's OAuth link/unlink calls (used by `handleLinkWallet`/`handleEditWallet`/
 * `handleEditTwitter` in the waitlist account-linking UI) hit the same
 * localhost stale-access-token limitation as `isPrivySiweLinkOrUnlinkRequest` above —
 * a live token is required, and on loopback that token can go stale mid-session
 * with no way to silently refresh it, so these 401 repeatedly until the stale
 * session is reset.
 */
export function isPrivyOauthLinkOrUnlinkRequest(url: string, method: string): boolean {
  if (normalizeFetchMethod(method) !== 'POST') return false
  try {
    const parsed = new URL(url)
    if (!PRIVY_PRIVY_IO_HOSTS.includes(parsed.hostname.toLowerCase())) return false
    return parsed.pathname === PRIVY_OAUTH_LINK_PATH || parsed.pathname === PRIVY_OAUTH_UNLINK_PATH
  } catch {
    return false
  }
}

export function isPrivyAppConfigRequest(url: string, method: string): boolean {
  if (normalizeFetchMethod(method) !== 'GET') return false
  try {
    const parsed = new URL(url)
    return (
      PRIVY_PRIVY_IO_HOSTS.includes(parsed.hostname.toLowerCase()) &&
      PRIVY_APP_CONFIG_PATH.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

/**
 * Privy dashboard sets `custom_api_url` to https://privy.4626.fun. On init the SDK
 * calls updateApiUrl() which enables server-cookie mode (`refresh_token: "deprecated"`).
 * Localhost cannot use those HttpOnly cookies — strip the field so the SDK stays on
 * auth.privy.io localStorage sessions.
 */
export function sanitizePrivyAppConfigPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const record = payload as Record<string, unknown>
  if (!record.custom_api_url) return payload
  const next = { ...record }
  delete next.custom_api_url
  return next
}

export async function sanitizePrivyAppConfigResponse(response: Response): Promise<Response> {
  if (!response.ok) return response
  try {
    const payload = await response.clone().json()
    const sanitized = sanitizePrivyAppConfigPayload(payload)
    if (sanitized === payload) return response
    const headers = new Headers(response.headers)
    headers.delete('content-length')
    return new Response(JSON.stringify(sanitized), {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch {
    return response
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
