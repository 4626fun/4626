export function createPrivyAppearance(options?: { showWalletLoginFirst?: boolean }) {
  return {
    showWalletLoginFirst: options?.showWalletLoginFirst ?? true,
    walletChainType: 'all',
    walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets'],
    landingHeader: 'Continue to 4626',
    loginMessage: 'Use verified email first, or continue with your wallet-native path.',
    theme: '#0f1117',
  } as const
}
