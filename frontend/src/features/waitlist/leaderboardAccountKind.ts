import type { WalletProviderId } from '@/lib/wallet/providerIdentity'
import { inferWalletProvider } from '@/lib/wallet/providerIdentity'

/** Single public account lane shown on the waitlist leaderboard. */
export type LeaderboardAccountKind = 'base_app' | 'zora' | 'coinbase_csw' | 'eoa' | 'unknown'

export function resolveLeaderboardAccountKind(input: {
  showZoraBadge?: boolean
  showBaseAppBadge?: boolean
  cswAddress?: string | null
  walletProvider?: string | null
}): LeaderboardAccountKind {
  if (input.showBaseAppBadge) return 'base_app'
  if (input.showZoraBadge) return 'zora'
  if (input.cswAddress) return 'coinbase_csw'
  if (input.walletProvider) return 'eoa'
  return 'unknown'
}

export function resolveLeaderboardWalletProvider(
  walletProvider: string | null | undefined,
): WalletProviderId {
  if (!walletProvider) return 'unknown'
  return inferWalletProvider({
    provider: walletProvider,
    walletType: 'external_eoa',
  })
}

export function leaderboardAccountKindLabel(kind: LeaderboardAccountKind, walletProvider?: WalletProviderId): string {
  switch (kind) {
    case 'base_app':
      return 'Base App'
    case 'zora':
      return 'Zora'
    case 'coinbase_csw':
      return 'Coinbase Smart Wallet'
    case 'eoa':
      if (walletProvider === 'rabby') return 'Rabby'
      if (walletProvider === 'metamask') return 'MetaMask'
      if (walletProvider === 'walletconnect') return 'WalletConnect'
      if (walletProvider === 'coinbase') return 'Coinbase Wallet'
      return 'External wallet'
    default:
      return 'Waitlist member'
  }
}
