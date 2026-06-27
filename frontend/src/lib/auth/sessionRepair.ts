import { isLocalXmtpStateInvalidError } from '@/lib/xmtp/xmtpHelpers'
import { isPrivyEmbeddedSignerAuthError } from '@/lib/auth/privyEmbeddedSignerAuthErrors'

/**
 * Shared, bounded session-repair primitive used by the waitlist login flow,
 * the XMTP chat connect path, and (indirectly) the Zora link fallback.
 *
 * Design goals (see plan "Stabilize waitlist login / Zora / chat auth recovery"):
 * - A single transient null Privy token read must NEVER be treated as a hard
 *   sign-out. True-stale requires repeated probe misses AND no live 4626 cookie.
 * - Every async hop is time-bounded so a hung Privy/iframe call cannot leave a
 *   "Repair"/"Connect" button stuck forever.
 * - Pure/injectable so the decision logic is unit-testable without React/Privy.
 */

export type SessionRepairOutcome =
  | 'repaired'
  | 'transient'
  | 'true-stale'
  | 'recovery-required'
  | 'no-privy'

export type StaleProbeOutcome = 'token' | 'transient' | 'true-stale'

export const SESSION_REPAIR_TOKEN_TIMEOUT_MS = 4_000
export const SESSION_REPAIR_BRIDGE_TIMEOUT_MS = 6_000
export const SESSION_REPAIR_REPROBE_DELAY_MS = 450
export const SESSION_REPAIR_STALE_THRESHOLD = 2

/**
 * Time-bound a promise; rejects with `${label} timed out` after `ms`.
 * Matches the waitlist `withTimeout` contract so callers can share one impl.
 */
export function withSessionRepairTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer))
  })
}

/** Decode a JWT `exp` claim into epoch-ms, or null when absent/malformed. */
export function decodeJwtExpiryMs(token: string | null): number | null {
  if (!token) return null
  const payloadSegment = token.split('.')[1]
  if (!payloadSegment) return null
  try {
    const payloadJson = atob(payloadSegment.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson) as { exp?: unknown }
    const exp = typeof payload.exp === 'number' ? payload.exp : null
    return exp !== null && Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

/** True when a token exists and is not within `skewMs` of (or past) expiry. */
export function isTokenLive(token: string | null, opts?: { now?: number; skewMs?: number }): boolean {
  if (!token) return false
  const expMs = decodeJwtExpiryMs(token)
  if (expMs === null) return true
  const now = typeof opts?.now === 'number' ? opts.now : Date.now()
  const skewMs = typeof opts?.skewMs === 'number' ? opts.skewMs : 30_000
  return expMs > now + skewMs
}

/**
 * Browser wallet-extension provider collisions (multiple injected wallets,
 * locked `window.ethereum` getter). These are cosmetic and must be excluded
 * from any stale-session / repairable-auth decision.
 */
export function isInjectedWalletCollisionMessage(message: string): boolean {
  const m = String(message || '').trim().toLowerCase()
  if (!m) return false
  return (
    m.includes('cannot set property ethereum of #<window> which has only a getter') ||
    m.includes('cannot redefine property: ethereum') ||
    m.includes('wallet proxy not initialized') ||
    m.includes('injected is not defined') ||
    (m.includes('multiple') && m.includes('injected') && m.includes('provider'))
  )
}

/**
 * True when a chat connect failure is an embedded-signer auth expiry that a
 * single session repair could plausibly fix. Explicitly excludes wallet
 * collision noise and broken local XMTP install state (which need OPFS reset,
 * not Privy re-auth).
 */
export function isSessionRepairableChatError(message: string): boolean {
  const m = String(message || '')
  if (!m) return false
  if (isInjectedWalletCollisionMessage(m)) return false
  if (isLocalXmtpStateInvalidError(m)) return false
  return isPrivyEmbeddedSignerAuthError(m)
}

type StaleSessionProbeDeps = {
  getToken: () => Promise<string | null>
  hasLiveCookie: () => boolean
  withTimeout?: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>
  delay?: (ms: number) => Promise<void>
  threshold?: number
  tokenTimeoutMs?: number
  reprobeDelayMs?: number
}

/**
 * Encapsulates the double-probe + miss-counter previously inlined in
 * `WaitlistFlow.probeStalePrivyTokenSession`. Each `probe()` reads the Privy
 * token twice (with a short delay) before counting a miss; only after
 * `threshold` misses with no live 4626 cookie does it report `true-stale`.
 */
export function createStaleSessionProbe(deps: StaleSessionProbeDeps) {
  const withTimeout = deps.withTimeout ?? withSessionRepairTimeout
  const delay =
    deps.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const threshold = Math.max(1, deps.threshold ?? SESSION_REPAIR_STALE_THRESHOLD)
  const tokenTimeoutMs = deps.tokenTimeoutMs ?? SESSION_REPAIR_TOKEN_TIMEOUT_MS
  const reprobeDelayMs = deps.reprobeDelayMs ?? SESSION_REPAIR_REPROBE_DELAY_MS

  let misses = 0

  const readToken = async (label: string): Promise<string | null> =>
    withTimeout(deps.getToken(), tokenTimeoutMs, label).catch(() => null)

  return {
    reset(): void {
      misses = 0
    },
    get missCount(): number {
      return misses
    },
    async probe(): Promise<StaleProbeOutcome> {
      const first = await readToken('Sign-in token probe')
      if (first) {
        misses = 0
        return 'token'
      }
      await delay(reprobeDelayMs)
      const second = await readToken('Sign-in token reprobe')
      if (second) {
        misses = 0
        return 'token'
      }
      misses += 1
      if (misses >= threshold && !deps.hasLiveCookie()) return 'true-stale'
      return 'transient'
    },
  }
}

type AttemptSessionRepairDeps = StaleSessionProbeDeps & {
  /** Exchange a Privy access token for a 4626 session cookie. */
  bridge: (token: string) => Promise<boolean>
  isRecoveryRequiredError: (error: unknown) => boolean
  bridgeTimeoutMs?: number
  /** Optional structured transition logger. */
  onTransition?: (event: { transition: string; outcome?: SessionRepairOutcome; missCount: number; hasLiveCookie: boolean }) => void
}

/**
 * Attempt one bounded session repair:
 * 1. Probe the Privy token (double-read). transient/true-stale short-circuit.
 * 2. Re-read the token and bridge it into a fresh 4626 cookie session.
 *
 * Returns a discriminated outcome so callers can decide whether to retry,
 * surface "expired", or escalate to recovery — without ever logging the user
 * out on a single transient miss.
 */
export async function attemptSessionRepair(deps: AttemptSessionRepairDeps): Promise<SessionRepairOutcome> {
  const withTimeout = deps.withTimeout ?? withSessionRepairTimeout
  const bridgeTimeoutMs = deps.bridgeTimeoutMs ?? SESSION_REPAIR_BRIDGE_TIMEOUT_MS
  const probe = createStaleSessionProbe(deps)

  const emit = (transition: string, outcome?: SessionRepairOutcome) => {
    deps.onTransition?.({
      transition,
      outcome,
      missCount: probe.missCount,
      hasLiveCookie: deps.hasLiveCookie(),
    })
  }

  const probed = await probe.probe()
  if (probed === 'transient') {
    emit('probe', 'transient')
    return 'transient'
  }
  if (probed === 'true-stale') {
    emit('probe', 'true-stale')
    return 'true-stale'
  }

  const token = await withTimeout(deps.getToken(), deps.tokenTimeoutMs ?? SESSION_REPAIR_TOKEN_TIMEOUT_MS, 'Repair token').catch(
    () => null,
  )
  if (!token) {
    const outcome: SessionRepairOutcome = deps.hasLiveCookie() ? 'transient' : 'true-stale'
    emit('repair-token-miss', outcome)
    return outcome
  }

  emit('bridging')
  try {
    const bridged = await withTimeout(deps.bridge(token), bridgeTimeoutMs, 'Repair bridge')
    if (bridged) {
      emit('repaired', 'repaired')
      return 'repaired'
    }
    const outcome: SessionRepairOutcome = deps.hasLiveCookie() ? 'transient' : 'true-stale'
    emit('bridge-empty', outcome)
    return outcome
  } catch (error: unknown) {
    if (deps.isRecoveryRequiredError(error)) {
      emit('recovery-required', 'recovery-required')
      return 'recovery-required'
    }
    const outcome: SessionRepairOutcome = deps.hasLiveCookie() ? 'transient' : 'true-stale'
    emit('bridge-error', outcome)
    return outcome
  }
}
