import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { bridgePrivySession } from '@/features/waitlist/waitlistHandoff'
import { isAlreadyLoggedInAuthError, runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import {
  assertPrivySessionMarkerCookie,
  isLocalDevPrivySessionMarkerMode,
} from '@/lib/privy/loopbackSessionMarkerShim'
import { readPrivyAccessTokenWithRetries } from '@/lib/privy/accessToken'
import { WAITLIST_RETURNING_WALLET_LOGIN_LIST } from '@/lib/privy/clientAppearance'
import type { SafePrivyClient } from '@/lib/privy/safeHooks'

type WaitlistBootstrapResponse = {
  requiresPrivyAuth: boolean
}

type AuthMeResponse = {
  address: string
} | null

const AUTH_SESSION_READ_BACKOFF_MS = 8_000
const AUTH_SESSION_CONFIRM_ATTEMPTS = 6
const AUTH_SESSION_CONFIRM_DELAY_MS = 150

let authSessionReadInFlight: Promise<string | null> | null = null
let authSessionReadBackoffUntil = 0

type ReadAuthSessionAddressOptions = {
  bypassBackoff?: boolean
  bypassSharedInflight?: boolean
}

export function resetAuthSessionReadBackoff(): void {
  authSessionReadBackoffUntil = 0
}

function readAuthSessionRetryAfterMs(response: Response): number {
  const raw = response.headers.get('retry-after')
  if (!raw) return AUTH_SESSION_READ_BACKOFF_MS
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1_000)
  const at = Date.parse(raw)
  if (Number.isFinite(at)) return Math.max(1_000, at - Date.now())
  return AUTH_SESSION_READ_BACKOFF_MS
}

async function fetchAuthSessionAddress(options: ReadAuthSessionAddressOptions = {}): Promise<string | null> {
  if (!options.bypassBackoff && Date.now() < authSessionReadBackoffUntil) return null

  const response = await apiFetch('/api/auth/me', {
    withCredentials: true,
    headers: { Accept: 'application/json' },
  }).catch(() => null)
  if (!response) return null
  if (response.status === 429) {
    authSessionReadBackoffUntil = Date.now() + readAuthSessionRetryAfterMs(response)
    return null
  }
  if (!response.ok) return null
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<AuthMeResponse> | null
  if (!payload?.success) return null
  const address = payload.data && typeof payload.data.address === 'string' ? payload.data.address.trim() : ''
  return address || null
}

export async function readAuthSessionAddress(options: ReadAuthSessionAddressOptions = {}): Promise<string | null> {
  if (!options.bypassSharedInflight && authSessionReadInFlight) return authSessionReadInFlight

  const readPromise = fetchAuthSessionAddress(options).finally(() => {
    if (authSessionReadInFlight === readPromise) authSessionReadInFlight = null
  })

  if (!options.bypassSharedInflight) authSessionReadInFlight = readPromise
  return readPromise
}

async function confirmAuthSessionAddressAfterBridge(
  bridgedAddress: string | null,
): Promise<string | null> {
  const normalizedBridge = bridgedAddress?.trim()
  if (normalizedBridge) return normalizedBridge

  resetAuthSessionReadBackoff()
  for (let attempt = 0; attempt < AUTH_SESSION_CONFIRM_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, AUTH_SESSION_CONFIRM_DELAY_MS * attempt)
      })
    }
    const address = await readAuthSessionAddress({
      bypassBackoff: true,
      bypassSharedInflight: true,
    })
    if (address) return address
  }
  return null
}

async function bootstrapWaitlist(privyAccessToken: string): Promise<WaitlistBootstrapResponse> {
  const token = privyAccessToken.trim()
  if (!token) {
    throw new Error('Missing Privy auth token.')
  }
  const response = await apiFetch('/api/waitlist/bootstrap', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<WaitlistBootstrapResponse> | null

  if (response.ok && payload?.success === false) {
    const code = typeof (payload as { code?: unknown })?.code === 'string' ? String((payload as { code?: unknown }).code) : ''
    const recoveryRequired =
      (payload as { recoveryRequired?: unknown })?.recoveryRequired === true ||
      code.toUpperCase().includes('RECOVERY_REQUIRED')
    if (recoveryRequired) {
      const err = new Error(
        typeof payload?.error === 'string' && payload.error.trim()
          ? payload.error.trim()
          : 'Recovery required',
      ) as Error & { recoveryRequired?: boolean; code?: string }
      err.recoveryRequired = true
      err.code = code || 'RECOVERY_REQUIRED'
      throw err
    }
  }

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.error || 'Could not finish waitlist signup.')
  }
  return payload.data
}

export function mapWaitlistWalletSignInError(error: unknown): string {
  if (error instanceof Error) {
    const code = String((error as Error & { code?: string }).code ?? '').toUpperCase()
    if (code === 'RECOVERY_REQUIRED_WALLET_BOUND') {
      return 'This wallet is linked to another account. Sign in with email.'
    }
    if ((error as Error & { recoveryRequired?: boolean }).recoveryRequired) {
      return error.message || 'Recovery required. Sign in with email to continue.'
    }
    const lower = error.message.toLowerCase()
    if (lower.includes('cancel') || lower.includes('reject') || lower.includes('closed')) {
      return 'Sign-in cancelled.'
    }
    if (error.message.trim()) return error.message
  }
  return 'Could not sign in with wallet. Please try again.'
}

export function isWaitlistWalletSignInCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase()
  return (
    message.includes('cancel') ||
    message.includes('reject') ||
    message.includes('closed') ||
    message.includes('denied')
  )
}

type PrivyWalletLoginFn = (input: {
  loginMethods: string[] | readonly string[]
  walletList?: readonly string[]
}) => void

const WALLET_LOGIN_AUTH_POLL_ATTEMPTS = 120
const WALLET_LOGIN_AUTH_POLL_DELAY_MS = 500
const WALLET_LOGIN_TOKEN_ATTEMPTS = 8
const WALLET_LOGIN_TOKEN_RETRY_DELAY_MS = 250
const WALLET_LOGIN_TOKEN_TIMEOUT_MS = 4_000

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

/**
 * Wait for Privy to report authenticated without calling getAccessToken.
 * Hammering getAccessToken while signed out triggers session refresh attempts
 * against privy.4626.fun and spams POST /api/v1/sessions 400s.
 */
async function waitForPrivyAuthenticated(params: {
  isAuthenticated: () => boolean
  attempts?: number
  retryDelayMs?: number
}): Promise<boolean> {
  const attempts = Math.max(1, Number(params.attempts ?? WALLET_LOGIN_AUTH_POLL_ATTEMPTS))
  const retryDelayMs = Math.max(0, Number(params.retryDelayMs ?? WALLET_LOGIN_AUTH_POLL_DELAY_MS))

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (params.isAuthenticated()) return true
    if (attempt < attempts - 1 && retryDelayMs > 0) {
      await sleep(retryDelayMs)
    }
  }
  return false
}

async function readExistingPrivyAccessToken(privy: SafePrivyClient): Promise<string> {
  return readPrivyAccessTokenWithRetries({
    read: privy.getAccessToken?.bind(privy) ?? null,
    attempts: 2,
    retryDelayMs: 100,
    timeoutMs: 2_000,
  })
}

/**
 * User clicked "Sign in with linked wallet" — clear any email-only Privy shell
 * so the wallet picker always opens instead of short-circuiting on an OTP token.
 */
async function prepareExplicitWalletPrivyLogin(privy: SafePrivyClient): Promise<void> {
  // Signed-out users must not call getAccessToken here — stale refresh cookies
  // would otherwise spam POST /api/v1/sessions on every wallet sign-in attempt.
  if (!privy.authenticated) return

  const existingToken = await readExistingPrivyAccessToken(privy)

  await runWaitlistPrivyLogout({
    logout: privy.logout ?? null,
    readToken: privy.getAccessToken ?? null,
    timeoutMs: 2_000,
    shouldLogout: Boolean(existingToken),
  })
}

let returningWalletSignInFlight: Promise<string> | null = null

/** Test-only reset for module-level wallet sign-in dedupe state. */
export function resetWaitlistReturningWalletSignInForTests(): void {
  returningWalletSignInFlight = null
}

export async function runWaitlistReturningWalletSignIn(params: {
  privy: SafePrivyClient
  login: PrivyWalletLoginFn
}): Promise<string> {
  if (returningWalletSignInFlight) {
    return returningWalletSignInFlight
  }

  returningWalletSignInFlight = (async () => {
    const { privy, login } = params

    await prepareExplicitWalletPrivyLogin(privy)

    try {
      if (isLocalDevPrivySessionMarkerMode()) {
        // Wallet SIWE link can 401 on loopback if Privy does not see the first-party
        // marker right before the login/link handshake starts.
        assertPrivySessionMarkerCookie()
      }
      login({
        loginMethods: ['wallet'],
        walletList: WAITLIST_RETURNING_WALLET_LOGIN_LIST,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message.trim() : String(error ?? '').trim()
      throw new Error(
        message || 'Could not open the wallet sign-in modal. Refresh the page and try again.',
      )
    }

    const authenticated = await waitForPrivyAuthenticated({
      isAuthenticated: () => privy.authenticated === true,
    })
    if (!authenticated) {
      throw new Error('Sign-in cancelled.')
    }

    const walletLoginToken = await readPrivyAccessTokenWithRetries({
      read: privy.getAccessToken?.bind(privy) ?? null,
      attempts: WALLET_LOGIN_TOKEN_ATTEMPTS,
      retryDelayMs: WALLET_LOGIN_TOKEN_RETRY_DELAY_MS,
      timeoutMs: WALLET_LOGIN_TOKEN_TIMEOUT_MS,
    })

    if (!walletLoginToken) {
      throw new Error(
        'Wallet sign-in completed but Privy access token is missing. Refresh the page and try again.',
      )
    }

    if (!isLocalDevPrivySessionMarkerMode()) {
      assertPrivySessionMarkerCookie()
    }

    try {
      return await establishWaitlistSessionAfterPrivyAuth({
        privy,
        missingTokenMessage: 'No account found for this wallet. Join with email first.',
        tokenAttempts: 8,
        tokenRetryDelayMs: 250,
        tokenTimeoutMs: null,
      })
    } catch (error) {
      if (isAlreadyLoggedInAuthError(error)) {
        await runWaitlistPrivyLogout({
          logout: privy.logout ?? null,
          readToken: privy.getAccessToken ?? null,
          timeoutMs: 2_000,
          shouldLogout: false,
        })
      }
      throw error
    }
  })()

  try {
    return await returningWalletSignInFlight
  } finally {
    returningWalletSignInFlight = null
  }
}

type EstablishWaitlistSessionInput = {
  privy: SafePrivyClient
  missingTokenMessage?: string
  tokenAttempts?: number
  tokenRetryDelayMs?: number
  tokenTimeoutMs?: number | null
  /**
   * Best-effort hook to ensure the caller has a Privy embedded EOA before we
   * bridge the session. Waitlist Privy modes disable auto-create-on-login
   * (`WAITLIST_EMBEDDED_WALLETS_OFF` in lib/privy/client.tsx), so a brand-new
   * email join otherwise has zero linked wallets at this point and
   * /api/auth/privy fails closed with 400 "No Privy wallet is ready yet."
   * Only the email-join tail supplies this; the wallet-sign-in path already
   * has a wallet and omits it.
   */
  ensureEmbeddedWallet?: () => Promise<unknown>
}

/**
 * `ensureEmbeddedWallet()` reads a ref snapshot of `privy.authenticated` that is
 * refreshed by a `useEffect` on every render of the caller. Immediately after
 * `loginWithCode` resolves, that snapshot can still be one render behind (we've
 * observed it read `authenticated: false` for a single render right after a
 * `passwordless/authenticate` retry), which makes `ensureEmbeddedWallet()` throw
 * synchronously and get swallowed as a no-op — leaving the join with zero linked
 * wallets and a 400 from `/api/auth/privy`. Retry a few times with a short delay
 * so React gets a chance to flush the pending re-render before we give up.
 */
async function ensureEmbeddedWalletBestEffort(
  ensureEmbeddedWallet: () => Promise<unknown>,
  logStep: (step: string, detail?: Record<string, unknown>) => void,
): Promise<void> {
  const attempts = 4
  const retryDelayMs = 200
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await ensureEmbeddedWallet()
      const resultRecord = result && typeof result === 'object' ? (result as Record<string, unknown>) : null
      logStep('ensure-embedded-wallet:success', {
        attempt,
        created: resultRecord?.created ?? null,
      })
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '')
      logStep('ensure-embedded-wallet:attempt-failed', { attempt, message })
      if (attempt < attempts) {
        await sleep(retryDelayMs)
      }
    }
  }
  logStep('ensure-embedded-wallet:gave-up', { attempts })
}

export async function establishWaitlistSessionAfterPrivyAuth(
  input: EstablishWaitlistSessionInput,
): Promise<string> {
  const { privy, missingTokenMessage } = input
  let bridged = false
  const logStep = (step: string, detail?: Record<string, unknown>) => {
    console.info('[waitlist-join]', { step, ...detail })
  }

  try {
    if (!isLocalDevPrivySessionMarkerMode()) {
      assertPrivySessionMarkerCookie()
    }

    logStep('read-token:start')
    const privyToken = await readPrivyAccessTokenWithRetries({
      read: privy.getAccessToken?.bind(privy) ?? null,
      attempts: input.tokenAttempts,
      retryDelayMs: input.tokenRetryDelayMs,
      timeoutMs: input.tokenTimeoutMs,
    })
    logStep('read-token:done', { hasToken: Boolean(privyToken) })
    if (!privyToken) {
      throw new Error(
        missingTokenMessage ??
          'Could not verify your session. Please try again. If the issue persists, try an incognito/private window or temporarily disable browser wallet extensions.',
      )
    }

    if (isLocalDevPrivySessionMarkerMode()) {
      assertPrivySessionMarkerCookie()
    }

    if (input.ensureEmbeddedWallet) {
      logStep('ensure-embedded-wallet:start')
      await ensureEmbeddedWalletBestEffort(input.ensureEmbeddedWallet, logStep)
      logStep('ensure-embedded-wallet:done')
    }

    logStep('bridge:start')
    const bridgeResult = await bridgePrivySession(privyToken)
    logStep('bridge:done', { ok: bridgeResult.ok })
    if (!bridgeResult.ok) {
      throw new Error('Could not create your app session. Please try again.')
    }
    bridged = true
    const bridgedSessionAddress = bridgeResult.address

    logStep('bootstrap:start')
    let bootstrap = await bootstrapWaitlist(privyToken)
    logStep('bootstrap:done', { requiresPrivyAuth: bootstrap.requiresPrivyAuth })
    if (bootstrap.requiresPrivyAuth) {
      const retryToken = await readPrivyAccessTokenWithRetries({
        read: privy.getAccessToken?.bind(privy) ?? null,
        attempts: 4,
        retryDelayMs: 200,
      })
      if (retryToken) {
        bootstrap = await bootstrapWaitlist(retryToken)
        logStep('bootstrap:retry-done', { requiresPrivyAuth: bootstrap.requiresPrivyAuth })
      }
    }
    if (bootstrap.requiresPrivyAuth) {
      throw new Error('No account found for this wallet. Join with email first.')
    }

    const confirmedSessionAddress = await confirmAuthSessionAddressAfterBridge(bridgedSessionAddress)
    logStep('confirm:done', { hasAddress: Boolean(confirmedSessionAddress) })
    if (!confirmedSessionAddress) {
      throw new Error('Sign-in finished but session is still syncing. Please try once more.')
    }
    return confirmedSessionAddress
  } catch (joinError) {
    logStep('error', {
      message: joinError instanceof Error ? joinError.message : String(joinError),
    })
    if (bridged) {
      await runWaitlistPrivyLogout({
        logout: privy.logout ?? null,
        readToken: privy.getAccessToken ?? null,
        shouldLogout: false,
      }).catch(() => {})
    }
    throw joinError
  }
}
