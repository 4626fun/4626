import { isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'

export type OwnerMutationSignerContext = {
  /** Address sent to preview-add/remove-owner as `connectedAddress`. */
  relayConnectedAddress: string | null
  isSelfAuthSession: boolean
  signingReady: boolean
  blockedReason: string | null
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

/**
 * Relay owner mutations have two lanes:
 * - **Self-auth CSW** — deposit from the custody smart wallet via Base App `wallet_sendCalls`.
 * - **External funder** — deposit from a connected on-chain owner EOA via `eth_sendTransaction`.
 *
 * Privy/wagmi often surfaces the embedded EOA as `connectedAddress` even when ETH lives on
 * the canonical CSW. Treating the embedded EOA as the external funder produces false
 * "insufficient funds" errors.
 */
export function resolveOwnerMutationSignerContext(params: {
  canonicalCswAddress?: string | null
  /** CSW that pays Relay deposit in self-auth mode (defaults to canonical / mutation target). */
  fundingCswAddress?: string | null
  /** Wagmi / controller connected address (may be embedded EOA). */
  connectedAddress?: string | null
  privyEmbeddedEoaAddress?: string | null
  /** When true, always use `fundingCswAddress` for self-auth (sub-account parent lane). */
  preferFundingCswSelfAuth?: boolean
}): OwnerMutationSignerContext {
  const fundingCsw = normalizeAddress(params.fundingCswAddress ?? params.canonicalCswAddress)
  const connected = normalizeAddress(params.connectedAddress)
  const embedded = normalizeAddress(params.privyEmbeddedEoaAddress)
  const inBaseApp = isBaseAppInAppContext()

  if (!fundingCsw) {
    return {
      relayConnectedAddress: connected ? params.connectedAddress!.trim() : null,
      isSelfAuthSession: false,
      signingReady: Boolean(connected),
      blockedReason: connected ? null : 'Connect a wallet that owns this CSW first.',
    }
  }

  const fundingCswChecksummed = params.fundingCswAddress ?? params.canonicalCswAddress!

  if (params.preferFundingCswSelfAuth || (inBaseApp && fundingCsw)) {
    return {
      relayConnectedAddress: fundingCswChecksummed,
      isSelfAuthSession: true,
      signingReady: true,
      blockedReason: null,
    }
  }

  if (connected && connected === fundingCsw) {
    return {
      relayConnectedAddress: fundingCswChecksummed,
      isSelfAuthSession: true,
      signingReady: true,
      blockedReason: null,
    }
  }

  if (connected && embedded && connected === embedded) {
    return {
      relayConnectedAddress: null,
      isSelfAuthSession: false,
      signingReady: false,
      blockedReason:
        '4626 is connected through your embedded signer, not your Coinbase Smart Wallet. Connect your Base smart wallet (or an external owner wallet with ETH) before submitting the Relay deposit.',
    }
  }

  if (connected) {
    return {
      relayConnectedAddress: params.connectedAddress!.trim(),
      isSelfAuthSession: false,
      signingReady: true,
      blockedReason: null,
    }
  }

  return {
    relayConnectedAddress: null,
    isSelfAuthSession: false,
    signingReady: false,
    blockedReason: 'Connect your Base smart wallet or an external owner wallet before continuing.',
  }
}
