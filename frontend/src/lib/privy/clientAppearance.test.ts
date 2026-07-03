import { describe, expect, it } from 'vitest'

import { createPrivyAppearance } from './clientAppearance'

describe('createPrivyAppearance', () => {
  it('uses the shared appearance config by default without an empty logo src', () => {
    expect(createPrivyAppearance()).toEqual({
      showWalletLoginFirst: false,
      walletChainType: 'all',
      walletList: ['metamask', 'coinbase_wallet', 'base_account', 'wallet_connect', 'detected_ethereum_wallets'],
      landingHeader: 'Continue to 4626',
      loginMessage: 'Use verified email first, or continue with your wallet-native path.',
      theme: '#0f1117',
    })
  })

  it('can prefer email first for waitlist auth', () => {
    expect(createPrivyAppearance({ showWalletLoginFirst: false })).toEqual({
      showWalletLoginFirst: false,
      walletChainType: 'all',
      walletList: ['metamask', 'coinbase_wallet', 'base_account', 'wallet_connect', 'detected_ethereum_wallets'],
      landingHeader: 'Continue to 4626',
      loginMessage: 'Use verified email first, or continue with your wallet-native path.',
      theme: '#0f1117',
    })
  })

  it('prioritizes detected ethereum wallets for waitlist returning sign-in', () => {
    expect(createPrivyAppearance({ walletList: ['detected_ethereum_wallets', 'metamask'] }).walletList).toEqual([
      'detected_ethereum_wallets',
      'metamask',
    ])
  })
})
