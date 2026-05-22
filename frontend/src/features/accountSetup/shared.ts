import type { OwnerAuthorityState, ProviderRow, ZoraResolveResponse, ConnectedOwnerState } from './types'

export const PROVIDER_ROWS: ProviderRow[] = [
  { provider: 'email', label: 'Email', hint: 'Notification channel' },
  { provider: 'google', label: 'Google', hint: 'OAuth identity' },
  { provider: 'apple', label: 'Apple', hint: 'OAuth identity' },
  { provider: 'twitter', label: 'Twitter/X', hint: 'Social identity' },
  { provider: 'telegram', label: 'Telegram', hint: 'Link from Telegram bot (/link)' },
  { provider: 'tiktok', label: 'TikTok', hint: 'Creator social signal' },
  { provider: 'external_eoa', label: 'Wallet connect (EOA)', hint: 'External signer wallet' },
]

export function shortValue(value: string | null | undefined): string {
  if (!value) return '—'
  if (value.length <= 18) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

export function hasResolvedZoraSignals(data: ZoraResolveResponse | null | undefined): boolean {
  // "Resolved" for setup progression means canonical wallet detection is present.
  // Handle/coin alone are useful identity hints but are not sufficient for wallet-ready state.
  return Boolean(data?.canonicalCswAddress)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isMobileWalletEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent || ''
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent)
}

export function deriveOwnerAuthorityState(input: {
  canonicalCswAddress: string | null
  connectedAddress: string | null | undefined
  connectedCanonicalWalletSelected: boolean
  connectedOwnerState: ConnectedOwnerState
}): OwnerAuthorityState {
  if (!input.canonicalCswAddress) {
    return {
      phase: 'blocked',
      label: 'Blocked',
      hint: 'Detect your canonical CSW first.',
      detail: 'We cannot verify signer authority until the Coinbase Smart Wallet is known.',
      badgeClass: 'border border-white/10 bg-white/5 text-zinc-400',
    }
  }

  if (input.connectedCanonicalWalletSelected) {
    return {
      phase: 'canonical_wallet',
      label: 'CSW connected',
      hint: `Connected as ${shortValue(input.connectedAddress)} — not an owner key`,
      detail:
        'This is your smart wallet address, not an owner wallet. Connect one of the listed EOA owners below to approve the one-time signing install.',
      badgeClass: 'border border-amber-400/20 bg-amber-500/10 text-amber-200',
    }
  }

  if (input.connectedOwnerState.value === true) {
    return {
      phase: 'owner_connected',
      label: 'Owner connected',
      hint: `Ready for one-time setup approval with ${shortValue(input.connectedAddress)}`,
      detail:
        'This wallet is already a current CSW owner. 4626 still needs its own execution signer path (sub-account or embedded owner), and this owner wallet is used to approve that one-time setup transaction.',
      badgeClass: 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    }
  }

  if (input.connectedOwnerState.reason === 'network_mismatch') {
    return {
      phase: 'needs_base',
      label: 'Base required',
      hint: 'Switch the connected wallet to Base and retry the owner check.',
      detail: 'Your signer must be connected on Base before 4626 can verify owner authority.',
      badgeClass: 'border border-amber-400/20 bg-amber-500/10 text-amber-200',
    }
  }

  if (input.connectedOwnerState.reason === 'read_failed') {
    return {
      phase: 'check_wallet',
      label: 'Check wallet',
      hint: 'We could not verify owner status from the connected wallet. Reconnect the owner wallet and retry.',
      detail: 'The owner read failed or the wallet provider did not answer the owner check cleanly.',
      badgeClass: 'border border-orange-400/20 bg-orange-500/10 text-orange-200',
    }
  }

  if (input.connectedAddress) {
    return {
      phase: 'wrong_wallet',
      label: 'Connect owner',
      hint: `Connected wallet ${shortValue(input.connectedAddress)} is not one of the current owners of this CSW.`,
      detail: 'Switch to one of the listed owner addresses below, then retry the approval step.',
      badgeClass: 'border border-rose-400/20 bg-rose-500/10 text-rose-200',
    }
  }

  return {
    phase: 'needs_wallet',
    label: 'Wallet required',
    hint: 'Connect a wallet that is already an owner of your existing Coinbase Smart Wallet.',
    detail: 'Once a current owner is connected, 4626 can prepare one Base approval transaction.',
    badgeClass: 'border border-white/10 bg-white/5 text-zinc-400',
  }
}
