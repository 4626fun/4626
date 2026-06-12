import type { Hex } from 'viem'

import { ensureSignatureHex } from '@/lib/aa/coinbaseErc4337Signature'

const RAW_DIGEST_RE = /^0x[0-9a-fA-F]{64}$/

export function isRawEcdsaDigest(value: unknown): value is Hex {
  return typeof value === 'string' && RAW_DIGEST_RE.test(value)
}

type WalletClientWithRequest = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  signMessage?: (args: {
    account?: string
    message: { raw: Hex } | Hex | string
  }) => Promise<Hex | string>
  /** Provider-aware session refresh (e.g. Privy access-token refresh + provider re-acquire). */
  refreshSession?: () => Promise<unknown>
}

function isMissingAuthTokenError(message: string): boolean {
  const normalized = String(message ?? '').trim().toLowerCase()
  return (
    normalized.includes('missing auth token') ||
    normalized.includes('auth token missing') ||
    normalized.includes('not authenticated') ||
    normalized.includes('authentication required')
  )
}

function isDisconnectedWalletSessionError(message: string): boolean {
  const normalized = String(message ?? '').trim().toLowerCase()
  return (
    normalized === 'disconnected' ||
    normalized.includes('wallet disconnected') ||
    normalized.includes('provider disconnected') ||
    normalized.includes('disconnected from wallet') ||
    normalized.includes('disconnected session')
  )
}

/**
 * Sign a 32-byte hash for Permit2 / UserOp lanes. Must NOT use personal_sign (EIP-191 prefix).
 * Prefer Privy `secp256k1_sign`, then `eth_sign` on the digest.
 */
export async function signRawEcdsaDigest(params: {
  digest: Hex
  signerAddress: string
  walletClient: WalletClientWithRequest
  label?: string
  refreshSession?: () => Promise<unknown>
}): Promise<Hex> {
  if (!isRawEcdsaDigest(params.digest)) {
    throw new Error('Expected a 32-byte digest for raw ECDSA signing.')
  }

  const label = params.label ?? 'signRawEcdsaDigest'
  const request = params.walletClient.request

  if (typeof request === 'function') {
    const signerAddress = String(params.signerAddress ?? '').trim()
    const requestAttempts: Array<{ method: string; params: unknown[]; suffix: string }> = [
      {
        method: 'secp256k1_sign',
        params: [params.digest],
        suffix: 'secp256k1_sign',
      },
      // Some providers require `address` in params for secp256k1_sign.
      {
        method: 'secp256k1_sign',
        params: [signerAddress, params.digest],
        suffix: 'secp256k1_sign_with_address',
      },
      {
        method: 'eth_sign',
        params: [signerAddress, params.digest],
        suffix: 'eth_sign',
      },
      // Some providers accept reversed eth_sign param order.
      {
        method: 'eth_sign',
        params: [params.digest, signerAddress],
        suffix: 'eth_sign_reversed',
      },
      // Some providers accept digest-only eth_sign for active account.
      {
        method: 'eth_sign',
        params: [params.digest],
        suffix: 'eth_sign_digest_only',
      },
    ]
    let attemptedSessionRefresh = false
    let refreshAttemptError: string | null = null

    const runRawSigningAttemptSet = async () => {
      const failures: Array<{ method: string; message: string }> = []
      for (const attempt of requestAttempts) {
        try {
          const rawSig = await request({
            method: attempt.method,
            params: attempt.params,
          })
          return {
            signature: ensureSignatureHex(rawSig, `${label}.${attempt.suffix}`),
            failures,
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error ?? 'unknown_error')
          failures.push({ method: attempt.method, message })
          // Continue trying the next raw-signing shape.
        }
      }
      return { signature: null as Hex | null, failures }
    }

    const firstPass = await runRawSigningAttemptSet()
    if (firstPass.signature) return firstPass.signature

    const hasRefreshableSessionFailure = firstPass.failures.some(
      (failure) =>
        isMissingAuthTokenError(failure.message) || isDisconnectedWalletSessionError(failure.message),
    )
    if (hasRefreshableSessionFailure) {
      attemptedSessionRefresh = true
      const refreshSession = params.refreshSession ?? params.walletClient.refreshSession
      try {
        if (typeof refreshSession === 'function') {
          // Provider-aware refresh (Privy access-token refresh + provider re-acquire) —
          // a stale Privy auth token cannot be fixed by eth_requestAccounts alone.
          await refreshSession()
        } else {
          // Generic fallback: lightweight account/session hydration, then a full account request.
          await request({ method: 'eth_accounts' }).catch(() => null)
          await request({ method: 'eth_requestAccounts' })
        }
      } catch (refreshError) {
        refreshAttemptError =
          refreshError instanceof Error ? refreshError.message : String(refreshError ?? 'unknown_error')
      }
      if (attemptedSessionRefresh) {
        const retryPass = await runRawSigningAttemptSet()
        if (retryPass.signature) return retryPass.signature
        firstPass.failures.push(...retryPass.failures)
      }
    }

    // Dedupe identical method failures so truncated error displays stay readable.
    const dedupedFailures: Array<{ method: string; message: string }> = []
    const seenFailures = new Set<string>()
    for (const failure of firstPass.failures) {
      const key = `${failure.method}:${failure.message}`
      if (seenFailures.has(key)) continue
      seenFailures.add(key)
      dedupedFailures.push(failure)
    }
    const attemptSummary =
      dedupedFailures.length > 0
        ? ` Method failures: ${dedupedFailures.map((item) => `${item.method}: ${item.message}`).join(' | ')}`
        : ''

    // Full diagnostics to console — UI error surfaces often truncate long messages.
    console.warn(`[${label}] raw digest signing failed`, {
      attemptedSessionRefresh,
      refreshAttemptError,
      failures: firstPass.failures,
    })

    // Lead with the actionable conclusion so truncated displays still show it.
    if (attemptedSessionRefresh && refreshAttemptError) {
      throw new Error(
        `Your signing session could not be refreshed: ${refreshAttemptError}. ` +
          `Sign out and sign in again (email OTP), then retry.${attemptSummary}`,
      )
    }
    if (attemptedSessionRefresh) {
      throw new Error(
        `Signing session was refreshed but raw digest signing still failed — sign out and sign in again, then retry.${attemptSummary}`,
      )
    }
    throw new Error(
      `Raw digest signing is unavailable for this wallet session. Reconnect the embedded signer (Sign in with Base / Privy embedded EOA) and retry.${attemptSummary}`,
    )
  }

  throw new Error(
    'Your wallet must support raw digest signing (secp256k1_sign or eth_sign) for smart-wallet Permit2. Reconnect and try again.',
  )
}
