type PrivyAppearanceOptions = {
  showWalletLoginFirst?: boolean
}

export function createPrivyAppearance(options?: PrivyAppearanceOptions) {
  const showWalletLoginFirst = options?.showWalletLoginFirst ?? false
  // `detected_ethereum_wallets` is Privy's EIP-6963 bucket (covers Rabby,
  // Phantom EVM, Frame, Trust, and any other 6963-advertised wallet);
  // `wallet_connect` covers mobile wallets (Rainbow, Zerion, etc.) via WC v2.
  const walletList = [
    'metamask',
    'coinbase_wallet',
    'base_account',
    'wallet_connect',
    'detected_ethereum_wallets',
  ]

  return {
    showWalletLoginFirst,
    walletChainType: 'all',
    walletList,
    landingHeader: 'Continue to 4626',
    loginMessage: 'Use verified email first, or continue with your wallet-native path.',
    theme: '#0f1117',
  } as const
}
