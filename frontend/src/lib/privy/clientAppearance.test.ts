import { describe, expect, it } from 'vitest'

import { createPrivyAppearance } from './clientAppearance'

describe('createPrivyAppearance', () => {
  it('uses the shared appearance config by default without an empty logo src', () => {
    expect(createPrivyAppearance()).toEqual({
      showWalletLoginFirst: false,
      walletChainType: 'all',
      walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets', 'wallet_connect'],
      landingHeader: 'Continue to 4626',
      loginMessage: 'Use verified email first, or continue with your wallet-native path.',
      theme: '#0f1117',
    })
  })

  it('drops detected wallet enumeration when injected-provider collision is present', () => {
    expect(createPrivyAppearance({ walletCollisionDetected: true })).toEqual({
      showWalletLoginFirst: false,
      walletChainType: 'all',
      walletList: ['coinbase_wallet', 'wallet_connect'],
      landingHeader: 'Continue to 4626',
      loginMessage: 'Use verified email first, or continue with your wallet-native path.',
      theme: '#0f1117',
    })
  })

  it('can prefer email first for waitlist auth', () => {
    expect(createPrivyAppearance({ showWalletLoginFirst: false })).toEqual({
      showWalletLoginFirst: false,
      walletChainType: 'all',
      walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets', 'wallet_connect'],
      landingHeader: 'Continue to 4626',
      loginMessage: 'Use verified email first, or continue with your wallet-native path.',
      theme: '#0f1117',
    })
  })
})
