import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/wallet/onboardingWallet'
import { writeStoredSessionToken } from '@/hooks/useSiweAuth'

/**
 * Handoff helpers for the `/waitlist` → `app.4626.fun/swap` transition.
 *
 * Contract note (FINDING-02 security fix):
 * `/api/auth/privy` and `/api/auth/handoff/create` now convey the 4626
 * session via an HttpOnly `cv_auth_session` cookie only — the server no
 * longer returns `sessionToken` in response JSON to prevent XSS
 * exfiltration. These helpers therefore use `withCredentials: true` and
 * rely on the cookie round-tripping between same-origin calls; no session
 * token is plumbed through memory.
 */

type HandoffCreateResponse = {
  code: string
  expiresAt: string
}

/**
 * Exchange a Privy access token for a 4626 session on the current origin.
 * The session itself lives in the HttpOnly `cv_auth_session` cookie; this
 * function just signals whether that cookie was successfully established
 * so the caller knows the next same-origin request will be authenticated.
 */
export async function bridgePrivySession(privyToken: string | null): Promise<boolean> {
  const token = typeof privyToken === 'string' ? privyToken.trim() : ''
  if (!token) return false

  const authRes = await apiFetch('/api/auth/privy', {
    method: 'POST',
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }).catch(() => null)

  const ok = Boolean(authRes?.ok)
  if (ok) {
    // FINDING-02: the 4626 session is now in the HttpOnly cv_auth_session
    // cookie. Clear any stale cv_siwe_session_token in sessionStorage so
    // apiBase.ts does not inject a mismatched Authorization header on
    // subsequent /api/* calls. Server prefers Bearer over cookie, so a
    // stale token would shadow the fresh cookie and surface as "logged
    // out on /swap" after a same-origin navigation (where the cross-origin
    // handoff redeem — which already clears sessionStorage — is skipped).
    writeStoredSessionToken(null)
  }
  return ok
}

/**
 * Ask the server for a one-time handoff code that the app origin can redeem
 * to mint an equivalent session on its own host. Authentication flows via
 * the `cv_auth_session` cookie (bridged by `bridgePrivySession` first);
 * the caller does not need to pass a session token explicitly.
 *
 * `privyToken` is forwarded in the body so the redeem side can optionally
 * also rebuild a Privy context on the app origin.
 */
export async function createAuthHandoffCode(params: { privyToken: string | null }): Promise<string> {
  const handoffRes = await apiFetch('/api/auth/handoff/create', {
    method: 'POST',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ privyToken: params.privyToken }),
  }).catch(() => null)

  const handoffJson = handoffRes
    ? ((await handoffRes.json().catch(() => null)) as ApiEnvelope<HandoffCreateResponse> | null)
    : null

  return handoffRes?.ok && handoffJson?.success && typeof handoffJson.data?.code === 'string'
    ? handoffJson.data.code.trim()
    : ''
}
