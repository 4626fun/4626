/**
 * Loopback-only shim for Privy apps configured with a custom auth domain.
 *
 * Apps with `custom_api_url` (ours: https://privy.4626.fun) put the Privy SDK
 * into server-cookie mode (`useServerCookies = true`). In that mode the SDK's
 * `getAccessToken()` requires a readable first-party `privy-session` marker
 * cookie on the app origin before it will return the access token it just
 * stored after login (`hasRefreshCredentials` = marker cookie OR a real
 * refresh token — cookie-mode logins return `refresh_token: "deprecated"`).
 *
 * On production the auth domain sets that marker on `.4626.fun`, so it is
 * visible. On localhost it is a blocked third-party cookie, so immediately
 * after a successful OTP login the SDK destroys its own freshly stored token
 * and `getAccessToken()` returns null forever — which our waitlist bootstrap
 * then (correctly) treats as a broken session and signs back out.
 *
 * Setting the marker ourselves on loopback origins makes the SDK serve the
 * in-storage access token for its lifetime (~1h), which is all local dev
 * needs. Production hosts are untouched — the shim only runs on loopback.
 *
 * The marker must be RE-asserted on an interval, not just set once: the SDK's
 * `destroyLocalState()` (which runs on any unauthenticated init or failed
 * token check) deletes the marker cookie again, and on localhost nothing else
 * ever restores it — so a one-shot write gets wiped before the post-OTP
 * `getAccessToken()` call that actually needs it.
 *
 * Known residual localhost limitation (NOT fixed by this shim): sessions do
 * not survive a hard page reload. The HttpOnly refresh cookie lives on the
 * auth domain and is a blocked third-party cookie from localhost, so the SDK
 * cannot silently restore the session — the page cleanly falls back to the
 * signed-out "Continue with email" state and you sign in again. Production
 * hosts (`*.4626.fun`) share the cookie domain and are unaffected.
 */
const MARKER_REASSERT_INTERVAL_MS = 2_000

let intervalStarted = false

function writeMarkerCookie(): void {
  try {
    // Mirrors the SDK's own localStorage-mode marker (`privy-session=t`,
    // 30-day expiry). No Secure flag: local dev runs over plain http.
    document.cookie = 'privy-session=t; path=/; max-age=2592000; SameSite=Strict'
  } catch {
    // Cookie writes can throw in exotic embedded contexts; the shim is
    // best-effort and the normal stale-session recovery path still applies.
  }
}

export function applyLoopbackPrivySessionMarkerShim(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const host = window.location.hostname.toLowerCase()
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  if (!isLoopback) return
  writeMarkerCookie()
  if (intervalStarted) return
  intervalStarted = true
  window.setInterval(writeMarkerCookie, MARKER_REASSERT_INTERVAL_MS)
}
