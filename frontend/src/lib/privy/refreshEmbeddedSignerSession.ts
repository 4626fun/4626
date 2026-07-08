import { getAccessToken } from '@privy-io/react-auth'

import { decodeJwtExpiryMs } from '@/lib/auth/sessionRepair'
import { assertPrivySessionMarkerCookie } from '@/lib/privy/loopbackSessionMarkerShim'

const TOKEN_SKEW_MS = 30_000
const SIGNER_READY_RETRY_DELAY_MS = 350

function isLoopbackHostname(hostname: string): boolean {
  const h = String(hostname ?? '').trim().toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]'
}

function buildExpiredSessionMessage(params: {
  refreshedToken: string | null
  tokenExpiresAtMs: number | null
}): string {
  const host = typeof window !== 'undefined' ? String(window.location?.hostname ?? '').toLowerCase() : ''
  const isLoopback = isLoopbackHostname(host)
  const staleDetail =
    params.refreshedToken && params.tokenExpiresAtMs !== null
      ? ` (token expired ${new Date(params.tokenExpiresAtMs).toLocaleTimeString()})`
      : ''
  return isLoopback
    ? `Privy session expired${staleDetail} and cannot be silently restored on localhost (auth-domain refresh cookie is blocked as third-party). Sign in again with email OTP.`
    : `Privy session expired${staleDetail} — sign in again with email OTP.`
}

function buildSignerNotReadyMessage(detail: string): string {
  return `Embedded wallet signing session could not be refreshed (${detail}). Sign out and sign in with email OTP again, then retry.`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Acquire the embedded wallet's Ethereum provider and confirm the iframe
 * signing channel is actually live with a cheap, non-signing RPC probe
 * (`eth_accounts`). Resolving `getEthereumProvider()` only means the SDK
 * handed back a provider object — it does NOT guarantee Privy's internal
 * `wallets/authenticate` handshake succeeded, which is the actual failure
 * this refresh needs to detect (a stale iframe can return a provider whose
 * first real RPC call still 401s with "Missing auth token").
 */
async function acquireReadyEmbeddedProvider(walletAny: Record<string, unknown>): Promise<void> {
  const getEthereumProvider = walletAny.getEthereumProvider
  if (typeof getEthereumProvider !== 'function') return

  const provider = (await getEthereumProvider.call(walletAny)) as { request?: unknown } | null | undefined
  const request = provider?.request
  if (typeof request !== 'function') return
  await (request as (args: { method: string }) => Promise<unknown>).call(provider, { method: 'eth_accounts' })
}

export type RefreshEmbeddedSignerSessionInput = {
  wallet?: unknown
  setActiveWallet?: (wallet: unknown) => unknown | Promise<unknown>
  getToken?: () => Promise<string | null>
  logLabel?: string
}

/**
 * Re-hydrate Privy embedded-wallet signing: marker cookie → access token →
 * active wallet selection → provider re-acquire.
 */
export async function refreshPrivyEmbeddedSignerSession(
  input: RefreshEmbeddedSignerSessionInput = {},
): Promise<true> {
  const logLabel = input.logLabel ?? 'privy-embedded-signer'
  assertPrivySessionMarkerCookie()

  const getToken = input.getToken ?? getAccessToken
  let refreshedToken: string | null = null
  try {
    refreshedToken = await getToken()
  } catch (err) {
    console.warn(`[${logLabel}] getAccessToken refresh failed:`, err)
  }

  const tokenExpiresAtMs = decodeJwtExpiryMs(refreshedToken)
  const tokenIsLive =
    Boolean(refreshedToken) && (tokenExpiresAtMs === null || tokenExpiresAtMs > Date.now() + TOKEN_SKEW_MS)
  if (!tokenIsLive) {
    throw new Error(buildExpiredSessionMessage({ refreshedToken, tokenExpiresAtMs }))
  }

  const walletAny = input.wallet as Record<string, unknown> | null | undefined
  if (walletAny && typeof input.setActiveWallet === 'function') {
    try {
      await Promise.resolve(input.setActiveWallet(walletAny))
    } catch (err) {
      console.warn(`[${logLabel}] setActiveWallet during refresh failed:`, err)
    }
  }

  if (walletAny) {
    try {
      await acquireReadyEmbeddedProvider(walletAny)
    } catch (firstErr) {
      // Privy's iframe token propagation can lag slightly right after
      // setActiveWallet — allow exactly one bounded retry before treating
      // this as a real signing-session failure that needs interactive
      // re-auth (see isPrivyEmbeddedSignerAuthError / isSigningSessionRecoveryRequired).
      console.warn(`[${logLabel}] embedded signer provider not ready on first probe; retrying once:`, firstErr)
      await sleep(SIGNER_READY_RETRY_DELAY_MS)
      if (typeof input.setActiveWallet === 'function') {
        await Promise.resolve(input.setActiveWallet(walletAny)).catch(() => undefined)
      }
      try {
        await acquireReadyEmbeddedProvider(walletAny)
      } catch (secondErr) {
        const detail = secondErr instanceof Error ? secondErr.message : String(secondErr)
        throw new Error(buildSignerNotReadyMessage(detail))
      }
    }
  }

  return true
}
