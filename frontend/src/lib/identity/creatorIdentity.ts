import type { Address } from 'viem'

import type { ZoraCoin } from '@/lib/zora/types'

export type CreatorIdentitySource =
  | 'zoraCoinCreatorAddress'
  | 'privySmartWallet'
  | 'connectedWallet'
  | 'unknown'

export type CreatorIdentityWarningCode =
  | 'CONNECTED_WALLET_MISMATCH'

export type CreatorIdentityResolution = {
  /** Canonical creator identity wallet (the identity that must not fragment). */
  canonicalIdentity: {
    address: Address | null
    source: CreatorIdentitySource
  }
  /** Currently connected wallet/account (execution context for the current session). */
  execution: {
    address: Address | null
  }
  /** Whether we have an existing creator coin identity we should enforce. */
  hasExistingCreatorCoinIdentity: boolean
  /** Block irreversible actions when true; caller should present UI guidance. */
  blockingReason: string | null
  /** Non-blocking warnings to show in UI. */
  warnings: CreatorIdentityWarningCode[]
}

function isAddressLike(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: unknown): Address | null {
  return isAddressLike(value) ? (value as Address) : null
}

/**
 * Resolve canonical creator identity in a way that prevents fragmentation.
 *
 * Rules (canonical-CSW-first approach):
 * - Existing creator coin creator address is the canonical identity.
 * - Privy smart wallet can execute only when it matches creator/payout for an existing coin.
 * - If no creator coin exists, never auto-promote Privy/EOA as canonical identity.
 * - Require an explicit canonical Zora Coinbase Smart Wallet before irreversible deploy actions.
 */
export function resolveCreatorIdentity(params: {
  connectedWallet: Address | null
  privySmartWallet?: Address | null
  zoraCoin?: ZoraCoin | null
}): CreatorIdentityResolution {
  const privyWallet = normalizeAddress(params.privySmartWallet)
  const connectedWallet = normalizeAddress(params.connectedWallet)
  const zoraCoinCreator = normalizeAddress(params.zoraCoin?.creatorAddress)
  const zoraCoinPayoutRecipient = normalizeAddress(params.zoraCoin?.payoutRecipientAddress)

  const warnings: CreatorIdentityWarningCode[] = []

  // 1) Existing creator coin identity (strongest signal)
  if (zoraCoinCreator) {
    const canonical = zoraCoinCreator

    // If Privy smart wallet matches the creator address OR the payout recipient, allow it
    if (privyWallet) {
      const privyLc = privyWallet.toLowerCase()
      const isCreator = canonical.toLowerCase() === privyLc
      const isPayoutRecipient = zoraCoinPayoutRecipient && zoraCoinPayoutRecipient.toLowerCase() === privyLc

      if (isCreator || isPayoutRecipient) {
        // Privy smart wallet is authorized - no blocking
        return {
          canonicalIdentity: { address: canonical, source: 'zoraCoinCreatorAddress' },
          execution: { address: privyWallet },
          hasExistingCreatorCoinIdentity: true,
          blockingReason: null,
          warnings,
        }
      }

      // Privy smart wallet doesn't match - block
      warnings.push('CONNECTED_WALLET_MISMATCH')
      return {
        canonicalIdentity: { address: canonical, source: 'zoraCoinCreatorAddress' },
        execution: { address: privyWallet },
        hasExistingCreatorCoinIdentity: true,
        blockingReason: `This creator coin belongs to ${canonical}. Your Privy wallet (${privyWallet}) doesn't match. Sign in with the account you used on Zora.`,
        warnings,
      }
    }

    // No Privy wallet - fall back to connected wallet check
    let blockingReason: string | null = null
    if (connectedWallet && connectedWallet.toLowerCase() !== canonical.toLowerCase()) {
      warnings.push('CONNECTED_WALLET_MISMATCH')
      blockingReason = `This creator coin's canonical identity is ${canonical}. You're connected as ${connectedWallet}. Sign in with Privy using the account you used on Zora.`
    } else if (!connectedWallet) {
      blockingReason = `Sign in to continue.`
    }

    return {
      canonicalIdentity: { address: canonical, source: 'zoraCoinCreatorAddress' },
      execution: { address: connectedWallet },
      hasExistingCreatorCoinIdentity: true,
      blockingReason,
      warnings,
    }
  }

  // 2) No existing coin: never infer canonical identity from Privy/EOA/custody fallbacks.
  //    These can be execution/session wallets, but canonical deploy identity must be explicit.
  const executionFallback = privyWallet ?? connectedWallet ?? null

  return {
    canonicalIdentity: { address: null, source: 'unknown' },
    execution: { address: executionFallback },
    hasExistingCreatorCoinIdentity: false,
    blockingReason: executionFallback
      ? 'No canonical Zora Coinbase Smart Wallet found yet. Privy wallets are sign-in only. Connect or create your canonical Coinbase Smart Wallet on Zora before deploying.'
      : 'Sign in to continue.',
    warnings,
  }
}
