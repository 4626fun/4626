import type { Address } from 'viem'

import type { ZoraCoin, ZoraProfile } from '@/lib/zora/types'

export type CreatorIdentitySource =
  | 'zoraCoinCreatorAddress'
  | 'privySmartWallet'
  | 'farcasterCustody'
  | 'zoraProfilePublicWallet'
  | 'connectedWallet'
  | 'unknown'

export type CreatorIdentityWarningCode =
  | 'CUSTODY_MISMATCH'
  | 'CONNECTED_WALLET_MISMATCH'
  | 'CUSTODY_UNAVAILABLE'

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
 * Rules (Privy-first approach):
 * - If Privy smart wallet is available and matches the creator coin's creator address, use it (no blocking).
 * - If a creator coin exists and Privy smart wallet doesn't match, block (wrong account).
 * - If no creator coin exists, use Privy smart wallet as the canonical identity for new deployments.
 * - Fallback to connected wallet only if Privy is unavailable.
 */
export function resolveCreatorIdentity(params: {
  connectedWallet: Address | null
  privySmartWallet?: Address | null
  zoraCoin?: ZoraCoin | null
  farcasterZoraProfile?: ZoraProfile | null
  farcasterCustodyAddress?: Address | null
}): CreatorIdentityResolution {
  const privyWallet = normalizeAddress(params.privySmartWallet)
  const connectedWallet = normalizeAddress(params.connectedWallet)
  const zoraCoinCreator = normalizeAddress(params.zoraCoin?.creatorAddress)
  const zoraCoinPayoutRecipient = normalizeAddress(params.zoraCoin?.payoutRecipientAddress)

  const farcasterPublicWallet = normalizeAddress(params.farcasterZoraProfile?.publicWallet?.walletAddress)
  const farcasterCustody = normalizeAddress(params.farcasterCustodyAddress)

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

    if (farcasterCustody && farcasterCustody.toLowerCase() !== canonical.toLowerCase()) {
      warnings.push('CUSTODY_MISMATCH')
    }

    return {
      canonicalIdentity: { address: canonical, source: 'zoraCoinCreatorAddress' },
      execution: { address: connectedWallet },
      hasExistingCreatorCoinIdentity: true,
      blockingReason,
      warnings,
    }
  }

  // 2) No existing coin - Privy smart wallet becomes the canonical identity for new deployments
  if (privyWallet) {
    return {
      canonicalIdentity: { address: privyWallet, source: 'privySmartWallet' },
      execution: { address: privyWallet },
      hasExistingCreatorCoinIdentity: false,
      blockingReason: null,
      warnings,
    }
  }

  // 3) Farcaster custody (fallback when Privy unavailable)
  if (farcasterCustody) {
    const canonical = farcasterCustody

    let blockingReason: string | null = null
    if (connectedWallet && connectedWallet.toLowerCase() !== canonical.toLowerCase()) {
      warnings.push('CONNECTED_WALLET_MISMATCH')
      blockingReason = `Your Farcaster custody wallet is ${canonical}. Sign in with Privy using that account.`
    } else if (!connectedWallet) {
      blockingReason = `Sign in to continue.`
    }

    return {
      canonicalIdentity: { address: canonical, source: 'farcasterCustody' },
      execution: { address: connectedWallet },
      hasExistingCreatorCoinIdentity: false,
      blockingReason,
      warnings,
    }
  }

  // 4) No coin + no Privy + no custody: require sign-in
  warnings.push('CUSTODY_UNAVAILABLE')

  if (farcasterPublicWallet) {
    return {
      canonicalIdentity: { address: farcasterPublicWallet, source: 'zoraProfilePublicWallet' },
      execution: { address: connectedWallet },
      hasExistingCreatorCoinIdentity: false,
      blockingReason: 'Sign in with Privy to continue.',
      warnings,
    }
  }

  if (connectedWallet) {
    return {
      canonicalIdentity: { address: connectedWallet, source: 'connectedWallet' },
      execution: { address: connectedWallet },
      hasExistingCreatorCoinIdentity: false,
      blockingReason: 'Sign in with Privy to continue.',
      warnings,
    }
  }

  return {
    canonicalIdentity: { address: null, source: 'unknown' },
    execution: { address: null },
    hasExistingCreatorCoinIdentity: false,
    blockingReason: 'Sign in to continue.',
    warnings,
  }
}
