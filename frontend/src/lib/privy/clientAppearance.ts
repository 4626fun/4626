type PrivyAppearanceOptions = {
  showWalletLoginFirst?: boolean
  walletList?: readonly string[]
  walletChainType?: 'ethereum-only' | 'solana-only' | 'ethereum-and-solana'
}

/** Wallet connectors used for Coinbase Smart Wallet / Base Account sign-in. */
export const BASE_ACCOUNT_WALLET_LOGIN_LIST = ['coinbase_wallet', 'base_account'] as const

/** Stable waitlist connector list for returning sign-in and post-join linking. */
export const WAITLIST_WALLET_JOINED_LOGIN_LIST = [
  'detected_ethereum_wallets',
  'coinbase_wallet',
  'base_account',
  'wallet_connect',
] as const

/**
 * Per-action override for returning-wallet sign-in only. The provider itself
 * stays on the stable waitlist mode; this list keeps the wallet modal light.
 */
export const WAITLIST_RETURNING_WALLET_LOGIN_LIST = [
  'detected_ethereum_wallets',
  'wallet_connect',
] as const

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
    walletChainType: options?.walletChainType ?? 'ethereum-and-solana',
    // Privy's WalletListEntry[] is mutable; spread so readonly tuples assign cleanly.
    walletList: [...walletList],
    landingHeader: 'Continue to 4626',
    loginMessage: 'Use verified email first, or continue with your wallet-native path.',
    theme: '#0f1117',
  } as const
}
