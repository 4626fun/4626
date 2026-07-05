type PrivyAppearanceOptions = {
  showWalletLoginFirst?: boolean
  walletList?: readonly string[]
  walletChainType?: 'all' | 'ethereum-only' | 'solana-only' | 'ethereum-and-solana'
}

/** Wallet connectors used for Coinbase Smart Wallet / Base Account sign-in. */
export const BASE_ACCOUNT_WALLET_LOGIN_LIST = ['coinbase_wallet', 'base_account'] as const

/**
 * Waitlist returning sign-in: surface EIP-6963-detected extensions (Rabby, Frame, etc.)
 * as first-class rows before named wallets. Privy does not expose a dedicated `rabby`
 * entry; detected wallets render individually at this list position on desktop.
 */
export const WAITLIST_RETURNING_WALLET_LOGIN_LIST = [
  'detected_ethereum_wallets',
  'wallet_connect',
] as const

/** Email-only waitlist must not mount WalletConnect / extension discovery rows. */
export const WAITLIST_EMAIL_ONLY_WALLET_LIST = [] as const

export function createPrivyAppearance(options?: PrivyAppearanceOptions) {
  const showWalletLoginFirst = options?.showWalletLoginFirst ?? false
  // `detected_ethereum_wallets` is Privy's EIP-6963 bucket (covers Rabby,
  // Phantom EVM, Frame, Trust, and any other 6963-advertised wallet);
  // `wallet_connect` covers mobile wallets (Rainbow, Zerion, etc.) via WC v2.
  const walletList = options?.walletList ?? [
    'metamask',
    ...BASE_ACCOUNT_WALLET_LOGIN_LIST,
    'wallet_connect',
    'detected_ethereum_wallets',
  ]

  return {
    showWalletLoginFirst,
    walletChainType: options?.walletChainType ?? 'all',
    walletList,
    landingHeader: 'Continue to 4626',
    loginMessage: 'Use verified email first, or continue with your wallet-native path.',
    theme: '#0f1117',
  } as const
}
