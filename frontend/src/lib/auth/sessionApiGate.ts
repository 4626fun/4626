/**
 * Session vs wallet gates for client data/signing.
 *
 * Cookie-backed `/api/*` reads must use {@link canUseSessionApi}.
 * Transaction / signature paths must also require {@link canSignWithSession}.
 *
 * Do not gate session APIs on wagmi `isConnected` or `isSignedIn`
 * (`isSignedIn` in useSiweAuth is walletMatchesSession, not "logged in").
 */

export type SessionApiGateInput = {
  sessionHydrated: boolean
  hasSession: boolean
}

export type SignWithSessionGateInput = SessionApiGateInput & {
  isConnected: boolean
  /** Prefer this over the legacy `isSignedIn` alias from useSiweAuth. */
  walletMatchesSession: boolean
}

/** True when cookie session is restored and present — safe to call session APIs. */
export function canUseSessionApi(input: SessionApiGateInput): boolean {
  return Boolean(input.sessionHydrated && input.hasSession)
}

/** True when session APIs are ready and the live wallet matches that session. */
export function canSignWithSession(input: SignWithSessionGateInput): boolean {
  return (
    canUseSessionApi(input) &&
    Boolean(input.isConnected) &&
    Boolean(input.walletMatchesSession)
  )
}
