import { getAccessToken } from '@privy-io/react-auth'

import { isPrivyEmbeddedSignerAuthError } from '@/lib/auth/privyEmbeddedSignerAuthErrors'
import { readPrivyAccessTokenOrNull } from '@/lib/privy/accessToken'
import { isLocalDevPrivySessionMarkerMode } from '@/lib/privy/loopbackSessionMarkerShim'
import { appendLocalhostPrivyAuthNoteIfNeeded } from '@/lib/privy/localhostPrivyAuthNotice'
import { isLivePrivyAccessToken } from '@/lib/privy/usePrivyAccessTokenReady'

const DEFAULT_TOKEN_ATTEMPTS = 12
const DEFAULT_TOKEN_RETRY_MS = 250
const DEFAULT_AUTHENTICATED_SETTLE_ATTEMPTS = 20
const DEFAULT_AUTHENTICATED_SETTLE_MS = 100
const DEFAULT_HYDRATE_ATTEMPTS = 24
const DEFAULT_HYDRATE_MS = 250
const DEFAULT_CREATE_WALLET_ATTEMPTS = 5
const DEFAULT_CREATE_WALLET_RETRY_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

export function isRetryablePrivyWalletAuthError(error: unknown): boolean {
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? '')
  if (!message.trim()) return false
  if (isPrivyEmbeddedSignerAuthError(message)) return true
  const lower = message.toLowerCase()
  return (
    lower.includes('missing auth token') ||
    (lower.includes('401') && (lower.includes('wallet') || lower.includes('authenticate'))) ||
    lower.includes('wallets/authenticate')
  )
}

export type WaitForPrivyEmbeddedWalletAuthReadyInput = {
  getToken?: () => Promise<string | null>
  isAuthenticated?: () => boolean
  tokenAttempts?: number
  tokenRetryDelayMs?: number
  authenticatedSettleAttempts?: number
  authenticatedSettleDelayMs?: number
}

export type PrivyEmbeddedWalletAuthReady = {
  token: string
}

/**
 * Wait until the app-level Privy access token is live and (optionally)
 * `authenticated` has flipped true. OTP success and iframe
 * `wallets/authenticate` are not atomic — callers must settle here before
 * `createWallet()` / SmartWallets `getClientForChain()`.
 */
export async function waitForPrivyEmbeddedWalletAuthReady(
  input: WaitForPrivyEmbeddedWalletAuthReadyInput = {},
): Promise<PrivyEmbeddedWalletAuthReady> {
  const getToken = input.getToken ?? (() => getAccessToken().catch(() => null))
  const token = await readPrivyAccessTokenOrNull({
    read: getToken,
    attempts: input.tokenAttempts ?? DEFAULT_TOKEN_ATTEMPTS,
    retryDelayMs: input.tokenRetryDelayMs ?? DEFAULT_TOKEN_RETRY_MS,
  })
  if (!isLivePrivyAccessToken(token)) {
    throw new Error(
      appendLocalhostPrivyAuthNoteIfNeeded(
        'Missing Privy auth token. Sign in and retry.',
      ),
    )
  }

  const settleAttempts = Math.max(
    1,
    Number(input.authenticatedSettleAttempts ?? DEFAULT_AUTHENTICATED_SETTLE_ATTEMPTS),
  )
  const settleDelayMs = Math.max(0, Number(input.authenticatedSettleDelayMs ?? DEFAULT_AUTHENTICATED_SETTLE_MS))
  if (typeof input.isAuthenticated === 'function') {
    for (let attempt = 0; attempt < settleAttempts; attempt += 1) {
      if (input.isAuthenticated()) break
      if (attempt < settleAttempts - 1 && settleDelayMs > 0) {
        await sleep(settleDelayMs)
      }
    }
    if (!input.isAuthenticated()) {
      throw new Error('Sign in with Privy before provisioning your embedded wallet.')
    }
  }

  return { token: token! }
}

export type HydrateEmbeddedWalletAddressInput = {
  readAddress: () => string | null | undefined
  attempts?: number
  retryDelayMs?: number
}

/**
 * Poll for an embedded EOA that may already exist on `privy.user` after
 * server-side `/api/auth/privy` provisioning (common on localhost where client
 * `createWallet` is skipped during join).
 */
export async function waitForHydratedEmbeddedWalletAddress(
  input: HydrateEmbeddedWalletAddressInput,
): Promise<string | null> {
  const attempts = Math.max(1, Number(input.attempts ?? DEFAULT_HYDRATE_ATTEMPTS))
  const retryDelayMs = Math.max(0, Number(input.retryDelayMs ?? DEFAULT_HYDRATE_MS))
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const address = String(input.readAddress() ?? '').trim()
    if (address) return address
    if (attempt < attempts - 1 && retryDelayMs > 0) {
      await sleep(retryDelayMs)
    }
  }
  return null
}

export type CreateWalletWithAuthRetriesInput = {
  createWallet: () => Promise<unknown>
  readExistingAddress?: () => string | null | undefined
  attempts?: number
  retryDelayMs?: number
}

/**
 * Call Privy `createWallet()` with retries for iframe auth races.
 * If an address appears mid-retry (hydrate / concurrent provision), return early.
 */
export async function createPrivyWalletWithAuthRetries(
  input: CreateWalletWithAuthRetriesInput,
): Promise<unknown> {
  const attempts = Math.max(1, Number(input.attempts ?? DEFAULT_CREATE_WALLET_ATTEMPTS))
  const retryDelayMs = Math.max(0, Number(input.retryDelayMs ?? DEFAULT_CREATE_WALLET_RETRY_MS))
  let lastError: unknown = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const existing = String(input.readExistingAddress?.() ?? '').trim()
    if (existing) return { address: existing, hydrated: true }

    try {
      return await input.createWallet()
    } catch (error) {
      lastError = error
      const message = String((error as { message?: unknown } | null)?.message ?? error ?? '')
      if (/already has an embedded wallet/i.test(message)) {
        throw error
      }
      if (!isRetryablePrivyWalletAuthError(error) || attempt >= attempts - 1) {
        throw error instanceof Error
          ? new Error(appendLocalhostPrivyAuthNoteIfNeeded(error.message))
          : error
      }
      await sleep(retryDelayMs)
    }
  }

  throw lastError instanceof Error
    ? new Error(appendLocalhostPrivyAuthNoteIfNeeded(lastError.message))
    : lastError
}

/**
 * Prefer hydrating a server-provisioned embedded EOA on localhost before any
 * client `createWallet()` that would load the privy.4626.fun iframe.
 */
export function shouldPreferHydrateBeforeClientCreateWallet(): boolean {
  return isLocalDevPrivySessionMarkerMode()
}
