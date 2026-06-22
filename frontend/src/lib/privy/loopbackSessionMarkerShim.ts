/**
 * Privy session marker shim for loopback and *.4626.fun origins.
 *
 * Apps with `custom_api_url` (ours: https://privy.4626.fun) put the Privy SDK
 * into server-cookie mode (`useServerCookies = true`). In that mode the SDK's
 * `getAccessToken()` requires a readable first-party `privy-session` marker
 * cookie on the app origin before it will return the access token it just
 * stored after login (`hasRefreshCredentials` = marker cookie OR a real
 * refresh token — cookie-mode logins return `refresh_token: "deprecated"`).
 *
 * Originally, `privy.4626.fun` set the marker cookie on `.4626.fun` (first-party
 * on production). Without the shim, on origins where the Privy refresh cookie is
 * a blocked third-party cookie, the SDK's `getAccessToken()` returns null after
 * OTP. The `resolvePrivyApiUrl()` in `featureFlags.ts` now returns
 * `https://privy.4626.fun` for `*.4626.fun` origins (first-party reverse proxy
 * via Vercel routes), but the marker cookie shim is still needed as a
 * belt-and-suspenders measure for the SDK's `hasRefreshCredentials` check. The same blocking occurs on localhost. In both cases, immediately
 * after a successful OTP login the SDK destroys its own freshly stored token
 * and `getAccessToken()` returns null forever — which our waitlist bootstrap
 * then (correctly) treats as a broken session and signs back out.
 *
 * Setting the marker ourselves on the app origin makes the SDK serve the
 * in-storage access token for its lifetime (~1h). The shim runs on:
 * - Loopback origins (localhost, 127.0.0.1) — for local dev
 * - *.4626.fun origins (4626.fun, www.4626.fun, app.4626.fun) — for production
 *
 * The marker must be RE-asserted on an interval, not just set once: the SDK's
 * `destroyLocalState()` (which runs on any unauthenticated init or failed
 * token check) deletes the marker cookie again, and on affected origins
 * nothing else ever restores it — so a one-shot write gets wiped before the
 * post-OTP `getAccessToken()` call that actually needs it.
 *
 * Known residual limitation (NOT fixed by this shim): sessions do not survive
 * a hard page reload on origins where the refresh cookie is a blocked
 * third-party cookie. The HttpOnly refresh cookie lives on the auth domain
 * and may be blocked, so the SDK cannot silently restore the session — the
 * page cleanly falls back to the signed-out state and you sign in again.
 */
const MARKER_REASSERT_INTERVAL_MS = 2_000

let intervalStarted = false

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

function writeMarkerCookie(): void {
  try {
    // Mirrors the SDK's own localStorage-mode marker (`privy-session=t`,
    // 30-day expiry). Add Secure flag on HTTPS origins for production safety.
    const secure = isSecureOrigin()
    document.cookie = `privy-session=t; path=/; max-age=2592000; SameSite=Strict${secure ? '; Secure' : ''}`
  } catch {
    // Cookie writes can throw in exotic embedded contexts; the shim is
    // best-effort and the normal stale-session recovery path still applies.
  }
}

export function applyLoopbackPrivySessionMarkerShim(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const host = window.location.hostname.toLowerCase()
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  const is4626Fun = is4626FunDomain(host)
  if (!isLoopback && !is4626Fun) return
  writeMarkerCookie()
  if (intervalStarted) return
  intervalStarted = true
  window.setInterval(writeMarkerCookie, MARKER_REASSERT_INTERVAL_MS)
}
