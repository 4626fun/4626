import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { bridgePrivySession } from '@/features/waitlist/waitlistHandoff'
import { isAlreadyLoggedInAuthError, runWaitlistPrivyLogout } from '@/features/waitlist/waitlistAuthState'
import { assertPrivySessionMarkerCookie } from '@/lib/privy/loopbackSessionMarkerShim'
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

let authSessionReadInFlight: Promise<string | null> | null = null
let authSessionReadBackoffUntil = 0

function readAuthSessionRetryAfterMs(response: Response): number {
  const raw = response.headers.get('retry-after')
  if (!raw) return AUTH_SESSION_READ_BACKOFF_MS
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1_000)
  const at = Date.parse(raw)
  if (Number.isFinite(at)) return Math.max(1_000, at - Date.now())
  return AUTH_SESSION_READ_BACKOFF_MS
}

export async function readAuthSessionAddress(): Promise<string | null> {
  if (Date.now() < authSessionReadBackoffUntil) return null
  if (authSessionReadInFlight) return authSessionReadInFlight

  authSessionReadInFlight = (async () => {
    try {
      const response = await apiFetch('/api/auth/me', {
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
      const address =
        payload.data && typeof payload.data.address === 'string' ? payload.data.address.trim() : ''
      return address || null
    } finally {
      authSessionReadInFlight = null
    }
  })()

  return authSessionReadInFlight
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

async function readExistingPrivyAccessToken(privy: SafePrivyClient): Promise<string> {
  return readPrivyAccessTokenWithRetries({
    read: privy.getAccessToken?.bind(privy) ?? null,
    attempts: 2,
    retryDelayMs: 100,
    timeoutMs: 2_000,
  })
}

/**
 * Returning waitlist wallet sign-in:
 * 1. Reuse an existing Privy session/token when present (never call login() twice).
 * 2. Open the wallet picker only when unauthenticated and token-less.
 * 3. Poll for a live access token after the user finishes in the Privy modal.
 */
async function clearStalePrivySessionBeforeWalletLogin(privy: SafePrivyClient): Promise<void> {
  const existingToken = await readExistingPrivyAccessToken(privy)
  if (!privy.authenticated && !existingToken) return

  await runWaitlistPrivyLogout({
    logout: privy.logout ?? null,
    readToken: privy.getAccessToken ?? null,
    timeoutMs: 2_000,
  })
}

export async function runWaitlistReturningWalletSignIn(params: {
  privy: SafePrivyClient
  login: PrivyWalletLoginFn
}): Promise<string> {
  const { privy, login } = params

  await clearStalePrivySessionBeforeWalletLogin(privy)

  login({
    loginMethods: ['wallet'],
    walletList: WAITLIST_RETURNING_WALLET_LOGIN_LIST,
  })

  const existingToken = await readPrivyAccessTokenWithRetries({
    read: privy.getAccessToken?.bind(privy) ?? null,
    attempts: 60,
    retryDelayMs: 500,
    timeoutMs: null,
  })

  if (!existingToken) {
    throw new Error('Sign-in cancelled.')
  }

  assertPrivySessionMarkerCookie()

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
      await clearStalePrivySessionBeforeWalletLogin(privy)
    }
    throw error
  }
}

type EstablishWaitlistSessionInput = {
  privy: SafePrivyClient
  missingTokenMessage?: string
  tokenAttempts?: number
  tokenRetryDelayMs?: number
  tokenTimeoutMs?: number | null
}

export async function establishWaitlistSessionAfterPrivyAuth(
  input: EstablishWaitlistSessionInput,
): Promise<string> {
  const { privy, missingTokenMessage } = input
  let bridged = false

  try {
    const privyToken = await readPrivyAccessTokenWithRetries({
      read: privy.getAccessToken?.bind(privy) ?? null,
      attempts: input.tokenAttempts,
      retryDelayMs: input.tokenRetryDelayMs,
      timeoutMs: input.tokenTimeoutMs,
    })
    if (!privyToken) {
      throw new Error(
        missingTokenMessage ??
          'Could not verify your session. Please try again. If the issue persists, try an incognito/private window or temporarily disable browser wallet extensions.',
      )
    }

    bridged = await bridgePrivySession(privyToken)
    if (!bridged) {
      throw new Error('Could not create your app session. Please try again.')
    }

    let bootstrap = await bootstrapWaitlist(privyToken)
    if (bootstrap.requiresPrivyAuth) {
      const retryToken = await readPrivyAccessTokenWithRetries({
        read: privy.getAccessToken?.bind(privy) ?? null,
        attempts: 4,
        retryDelayMs: 200,
      })
      if (retryToken) {
        bootstrap = await bootstrapWaitlist(retryToken)
      }
    }
    if (bootstrap.requiresPrivyAuth) {
      throw new Error('No account found for this wallet. Join with email first.')
    }

    const confirmedSessionAddress = await readAuthSessionAddress()
    if (!confirmedSessionAddress) {
      throw new Error('Sign-in finished but session is still syncing. Please try once more.')
    }
    return confirmedSessionAddress
  } catch (joinError) {
    if (bridged) {
      await runWaitlistPrivyLogout({
        logout: privy.logout ?? null,
        readToken: privy.getAccessToken ?? null,
      }).catch(() => {})
    }
    throw joinError
  }
}
