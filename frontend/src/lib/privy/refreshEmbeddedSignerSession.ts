import { getAccessToken } from '@privy-io/react-auth'

import { decodeJwtExpiryMs } from '@/lib/auth/sessionRepair'
import { assertPrivySessionMarkerCookie } from '@/lib/privy/loopbackSessionMarkerShim'

const TOKEN_SKEW_MS = 30_000

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

  const getEthereumProvider = walletAny?.getEthereumProvider
  if (typeof getEthereumProvider === 'function') {
    await Promise.resolve(getEthereumProvider.call(walletAny)).catch(() => null)
  }

  return true
}
