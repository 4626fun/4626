type PrivyAppearanceOptions = {
  showWalletLoginFirst?: boolean
  walletCollisionDetected?: boolean
}

export function createPrivyAppearance(options?: PrivyAppearanceOptions) {
  const showWalletLoginFirst = options?.showWalletLoginFirst ?? false
  const prefersEmailFirst = showWalletLoginFirst === false
  const walletList = options?.walletCollisionDetected || prefersEmailFirst
    ? ['coinbase_wallet']
    : ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets']

  return {
    showWalletLoginFirst,
    walletChainType: 'all',
    walletList,
    landingHeader: 'Continue to 4626',
    loginMessage: 'Use verified email first, or continue with your wallet-native path.',
    theme: '#0f1117',
  } as const
}
