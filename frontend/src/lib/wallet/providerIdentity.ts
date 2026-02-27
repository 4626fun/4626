export type WalletProviderId =
  | 'coinbase'
  | 'privy'
  | 'metamask'
  | 'rabby'
  | 'walletconnect'
  | 'unknown'

function normalizeToken(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function inferWalletProvider(params: {
  provider?: string | null
  walletType?: string | null
  connectorId?: string | null
  isCanonicalSmartWallet?: boolean
}): WalletProviderId {
  const provider = normalizeToken(params.provider)
  const walletType = normalizeToken(params.walletType)
  const connectorId = normalizeToken(params.connectorId)

  if (provider.includes('rabby') || connectorId.includes('rabby')) return 'rabby'
  if (provider.includes('metamask') || connectorId.includes('metamask') || connectorId.includes('io.metamask')) {
    return 'metamask'
  }
  if (
    provider.includes('walletconnect') ||
    provider.includes('wallet_connect') ||
    provider === 'wc' ||
    connectorId.includes('walletconnect')
  ) {
    return 'walletconnect'
  }
  if (provider.includes('privy') || provider.includes('embedded')) return 'privy'
  if (
    provider.includes('coinbase') ||
    provider.includes('base account') ||
    provider.includes('coinbase smart wallet') ||
    connectorId === 'coinbasewalletsdk' ||
    connectorId === 'com.coinbase.wallet'
  ) {
    return 'coinbase'
  }

  if (params.isCanonicalSmartWallet || walletType === 'smart_wallet') return 'coinbase'

  return 'unknown'
}

export function walletProviderLabel(provider: WalletProviderId): string {
  switch (provider) {
    case 'coinbase':
      return 'Coinbase'
    case 'privy':
      return 'Privy'
    case 'metamask':
      return 'MetaMask'
    case 'rabby':
      return 'Rabby'
    case 'walletconnect':
      return 'WalletConnect'
    default:
      return 'Wallet'
  }
}
