import { apiFetch } from '@/lib/api/apiBase'
import { normalizeAlfaClubWaitlistReturnPath } from '@/lib/auth/waitlistEntry'
import { ALFACLUB_ORIGIN, getAppBaseUrl } from '@/lib/env/host'
import type { ApiEnvelope } from '@/lib/wallet/onboardingBootstrapTypes'
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

export type BridgePrivySessionResult =
  | { ok: true; address: string }
  | { ok: false; address?: null; error?: string | null }

/**
 * Exchange a Privy access token for a 4626 session on the current origin.
 * The session lives in the HttpOnly `cv_auth_session` cookie; the bridged
 * address is returned from `/api/auth/privy` so callers do not need an
 * immediate `/api/auth/me` round-trip (which can race cookie propagation,
 * client read backoff, or stale Bearer shadowing).
 */
export async function bridgePrivySession(privyToken: string | null): Promise<BridgePrivySessionResult> {
  const token = typeof privyToken === 'string' ? privyToken.trim() : ''
  if (!token) return { ok: false }

  const authRes = await apiFetch('/api/auth/privy', {
    method: 'POST',
    withCredentials: true,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  }).catch(() => null)

  const payload = authRes
    ? ((await authRes.json().catch(() => null)) as ApiEnvelope<{ address?: unknown }> | null)
    : null

  if (authRes?.status === 409) {
    const code = typeof (payload as any)?.code === 'string' ? String((payload as any).code) : ''
    const recoveryRequired =
      (payload as any)?.recoveryRequired === true ||
      code.toUpperCase().includes('RECOVERY_REQUIRED')
    if (recoveryRequired) {
      const err = new Error(
        typeof (payload as any)?.error === 'string'
          ? String((payload as any).error)
          : 'Recovery required',
      ) as Error & { recoveryRequired?: boolean; code?: string }
      err.recoveryRequired = true
      err.code = code || 'RECOVERY_REQUIRED_EMAIL_BOUND'
      throw err
    }
  }

  const ok = Boolean(authRes?.ok && payload?.success)
  if (!ok) {
    const error =
      payload && typeof payload.error === 'string' && payload.error.trim()
        ? payload.error.trim()
        : authRes
          ? `Could not create your app session (HTTP ${authRes.status}).`
          : 'Could not create your app session. Please try again.'
    return { ok: false, error }
  }

  const address =
    payload?.data && typeof payload.data.address === 'string' ? payload.data.address.trim() : ''
  if (!address) {
    return { ok: false, error: 'Could not create your app session. Please try again.' }
  }

  // The 4626 session lives in the HttpOnly cv_auth_session cookie. Remove any
  // bearer left by older clients during the cookie-only migration.
  writeStoredSessionToken(null)
  return { ok: true, address }
}

/**
 * Ask the server for a one-time handoff code that the app origin can redeem
 * to mint an equivalent session on its own host. Authentication flows via
 * the `cv_auth_session` cookie (bridged by `bridgePrivySession` first);
 * the caller does not need to pass a session token explicitly.
 *
 * `expectedAddress` binds creation to the principal established immediately
 * before this call, preventing another tab from swapping the shared cookie.
 */
export async function createAuthHandoffCode(params: {
  privyToken: string | null
  expectedAddress?: string | null
}): Promise<string> {
  const handoffRes = await apiFetch('/api/auth/handoff/create', {
    method: 'POST',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      privyToken: params.privyToken,
      ...(params.expectedAddress ? { expectedAddress: params.expectedAddress } : {}),
    }),
  }).catch(() => null)

  const handoffJson = handoffRes
    ? ((await handoffRes.json().catch(() => null)) as ApiEnvelope<HandoffCreateResponse> | null)
    : null

  return handoffRes?.ok && handoffJson?.success && typeof handoffJson.data?.code === 'string'
    ? handoffJson.data.code.trim()
    : ''
}

/**
 * Refresh the waitlist session from the currently verified Privy identity
 * before transferring it to the app host. This replaces historical cookies
 * whose address is still linked to the profile but is no longer an authorized
 * canonical/active signer.
 */
export async function createAppAuthHandoffTarget(params: {
  privyToken: string | null
}): Promise<string> {
  const token = typeof params.privyToken === 'string' ? params.privyToken.trim() : ''
  if (!token) return ''

  const bridge = await bridgePrivySession(token)
  if (!bridge.ok) return ''

  const code = await createAuthHandoffCode({
    privyToken: null,
    expectedAddress: bridge.address,
  })
  if (!code) return ''

  const target = new URL('/swap', getAppBaseUrl())
  target.searchParams.set('cv_handoff', code)
  return target.toString()
}

export async function createAlfaClubAuthHandoffTarget(params: {
  returnPath: string
}): Promise<string> {
  const returnPath = normalizeAlfaClubWaitlistReturnPath(params.returnPath)
  if (!returnPath) return ''

  // The accepted waitlist profile is represented by the existing HttpOnly
  // session. Never replace that principal from ambient Privy state while
  // constructing a cross-host continuation.
  const code = await createAuthHandoffCode({ privyToken: null })
  if (!code) return ''

  const target = new URL(returnPath, ALFACLUB_ORIGIN)
  target.searchParams.set('cv_handoff', code)
  return target.toString()
}
