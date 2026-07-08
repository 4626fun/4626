import { isLocalDevOrigin } from '@/lib/flags/flags'

/**
 * Privy session marker shim for local dev and *.4626.fun origins.
 *
 * Apps with `custom_api_url` (ours: https://privy.4626.fun) put the Privy SDK
 * into server-cookie mode (`useServerCookies = true`). In that mode the SDK's
 * `getAccessToken()` requires a readable first-party `privy-session` marker
 * cookie on the app origin before it will return the access token it just
 * stored after login (`hasRefreshCredentials` = marker cookie OR a real
 * refresh token — cookie-mode logins return `refresh_token: "deprecated"`).
 *
 * On **localhost**, the HttpOnly refresh cookie on `privy.4626.fun` is a blocked
 * third-party cookie. Asserting the marker **before** auth makes the SDK attempt
 * `POST /api/v1/sessions` with `refresh_token: "deprecated"`, which 400s with
 * `missing_or_invalid_token`. Local dev therefore clears the marker while signed
 * out and only asserts it immediately before post-login `getAccessToken()` reads
 * (see `readPrivyAccessTokenWithRetries`) or after Privy reports authenticated.
 *
 * On **\*.4626.fun** production hosts the refresh cookie is first-party via the
 * reverse proxy, so the legacy interval assert remains as belt-and-suspenders.
 */
const MARKER_REASSERT_INTERVAL_MS = 2_000
const PRIVY_REFRESH_TOKEN_STORAGE_KEY = 'privy:refresh_token'
const PRIVY_DEPRECATED_REFRESH_TOKEN = 'deprecated'
const PRIVY_SERVER_COOKIE_STORAGE_KEYS = [
  'privy:refresh_token',
  'privy:token',
  'privy:pat',
  'privy:id_token',
] as const

/** Dispatched on `window` after `resetPrivyLoopbackSessionAfterAuthFailure` runs. */
export const PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT = 'cv-privy-loopback-session-expired'

let productionIntervalStarted = false

function isSecureOrigin(): boolean {
  try {
    return window.location.protocol === 'https:'
  } catch {
    return false
  }
}

function is4626FunDomain(hostname: string): boolean {
  const h = hostname.toLowerCase().trim()
  return h === '4626.fun' || h.endsWith('.4626.fun')
}

export function shouldUseLoopbackPrivySessionMarkerShim(): boolean {
  if (typeof window === 'undefined') return false
  const is4626Fun = is4626FunDomain(window.location.hostname.toLowerCase())
  const isLocalDev = isLocalDevOrigin(window.location.origin)
  return isLocalDev || is4626Fun
}

export function isLocalDevPrivySessionMarkerMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return isLocalDevOrigin(window.location.origin)
  } catch {
    // Partial window contexts (tests, exotic embeds) may lack location; best-effort only.
    return false
  }
}

export function assertPrivySessionMarkerCookie(): void {
  try {
    const secure = isSecureOrigin()
    document.cookie = `privy-session=t; path=/; max-age=2592000; SameSite=Strict${secure ? '; Secure' : ''}`
  } catch {
    // Cookie writes can throw in exotic embedded contexts; best-effort only.
  }
}

export function clearPrivySessionMarkerCookie(): void {
  try {
    const secure = isSecureOrigin()
    document.cookie = `privy-session=; path=/; max-age=0; SameSite=Strict${secure ? '; Secure' : ''}`
  } catch {
    // best-effort
  }
}

function writeMarkerCookie(): void {
  assertPrivySessionMarkerCookie()
}

function removePrivyServerCookieModeStorageKeys(): void {
  for (const key of PRIVY_SERVER_COOKIE_STORAGE_KEYS) {
    window.localStorage.removeItem(key)
  }
}

/** Drop stale server-cookie-mode Privy storage left from prior localhost sessions. */
export function clearPrivyServerCookieModeStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const refresh = window.localStorage.getItem(PRIVY_REFRESH_TOKEN_STORAGE_KEY)
    if (refresh !== PRIVY_DEPRECATED_REFRESH_TOKEN) return
    removePrivyServerCookieModeStorageKeys()
  } catch {
    // best-effort
  }
}

/**
 * Local dev's `custom_api_url` loopback workaround (see privyLoopbackFetchRewrite.ts)
 * cannot perform a real server-cookie refresh, so a Privy access token that expires
 * mid-session leaves stale storage behind that fails the same way on every retry
 * (e.g. `POST /api/v1/siwe/link` 401 when linking a wallet). Once that 401 is observed,
 * wipe the stale storage/marker unconditionally so the SDK discovers it has no valid
 * session on its next read instead of reusing the dead token, and notify listeners
 * that a fresh sign-in is required.
 */
export function resetPrivyLoopbackSessionAfterAuthFailure(): void {
  if (typeof window === 'undefined') return
  if (!isLocalDevPrivySessionMarkerMode()) return
  try {
    removePrivyServerCookieModeStorageKeys()
  } catch {
    // best-effort
  }
  clearPrivySessionMarkerCookie()
  try {
    window.dispatchEvent(new CustomEvent(PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT))
  } catch {
    // best-effort
  }
}

/** True when loopback localStorage still holds a non-deprecated Privy session. */
export function hasPersistedPrivyLoopbackSession(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const refresh = window.localStorage.getItem(PRIVY_REFRESH_TOKEN_STORAGE_KEY)
    if (refresh && refresh !== PRIVY_DEPRECATED_REFRESH_TOKEN) return true
    const token = window.localStorage.getItem('privy:token')
    return Boolean(String(token ?? '').trim())
  } catch {
    return false
  }
}

export function applyLoopbackPrivySessionMarkerShim(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!shouldUseLoopbackPrivySessionMarkerShim()) return

  if (isLocalDevPrivySessionMarkerMode()) {
    clearPrivyServerCookieModeStorage()
    // OAuth redirect returns reload the page while Privy still holds a session in
    // localStorage. Assert the marker early so oauth/link can attach the auth token.
    if (hasPersistedPrivyLoopbackSession()) {
      assertPrivySessionMarkerCookie()
    } else {
      // Signed-out localhost loads must not advertise refresh credentials.
      clearPrivySessionMarkerCookie()
    }
    return
  }

  writeMarkerCookie()
  if (productionIntervalStarted) return
  productionIntervalStarted = true
  window.setInterval(writeMarkerCookie, MARKER_REASSERT_INTERVAL_MS)
}
