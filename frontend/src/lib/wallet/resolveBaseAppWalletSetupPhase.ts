import {
  isCanonicalBaseAccountWalletReady,
  normalizeWalletAddress,
} from '@/lib/wallet/ensureCanonicalBaseAccountWallet'

/**
 * Consolidated Base App wallet setup phases for parent-CSW signing.
 *
 * Layer 1 — Privy session (email OTP) creates the embedded EOA.
 * Layer 2 — Base Account wallet connected and matching profiles.csw_address.
 * Layer 3 — Embedded EOA is an on-chain owner of the parent CSW (4626 signing).
 */
export type BaseAppWalletSetupPhase =
  | 'needs-privy-session'
  | 'needs-canonical-csw'
  | 'needs-base-wallet-connect'
  | 'needs-owner-install'
  | 'ready'

export function resolveBaseAppWalletSetupPhase(params: {
  privyAuthenticated: boolean
  embeddedEoaAddress: string | null | undefined
  canonicalCswAddress: string | null | undefined
  wallets: unknown[]
  providerAccounts?: string[] | null
  parentEmbeddedOwnerOnChain?: boolean
  executionTrack?: 'legacy-owner-install' | 'none-yet' | null
}): BaseAppWalletSetupPhase {
  if (!params.privyAuthenticated || !normalizeWalletAddress(params.embeddedEoaAddress)) {
    return 'needs-privy-session'
  }

  const canonical = normalizeWalletAddress(params.canonicalCswAddress)
  if (!canonical) {
    return 'needs-canonical-csw'
  }

  const baseWalletReady = isCanonicalBaseAccountWalletReady({
    wallets: params.wallets,
    canonicalCswAddress: params.canonicalCswAddress,
    providerAccounts: params.providerAccounts,
  })
  if (!baseWalletReady) {
    return 'needs-base-wallet-connect'
  }

  if (
    params.parentEmbeddedOwnerOnChain === true ||
    params.executionTrack === 'legacy-owner-install'
  ) {
    return 'ready'
  }

  return 'needs-owner-install'
}

export function isBaseAppWalletSetupReady(phase: BaseAppWalletSetupPhase): boolean {
  return phase === 'ready'
}
