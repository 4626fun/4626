import { describe, expect, it } from 'vitest'

import { createPrivyAppearance } from './clientAppearance'

describe('createPrivyAppearance', () => {
  it('uses wallet-first appearance by default without an empty logo src', () => {
    expect(createPrivyAppearance()).toEqual({
      showWalletLoginFirst: true,
      walletChainType: 'all',
      walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets'],
      landingHeader: 'Continue to 4626',
      loginMessage: 'Use wallet, email, or social to finish your waitlist signup.',
      theme: '#0f1117',
    })
  })

  it('can prefer email/social first for waitlist auth', () => {
    expect(createPrivyAppearance({ showWalletLoginFirst: false })).toEqual({
      showWalletLoginFirst: false,
      walletChainType: 'all',
      walletList: ['metamask', 'coinbase_wallet', 'detected_ethereum_wallets'],
      landingHeader: 'Continue to 4626',
      loginMessage: 'Use wallet, email, or social to finish your waitlist signup.',
      theme: '#0f1117',
    })
  })
})
