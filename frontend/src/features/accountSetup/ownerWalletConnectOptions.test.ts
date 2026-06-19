import { describe, expect, it } from 'vitest'

import { buildOwnerWalletConnectList, mapOwnerWalletConnectError } from './ownerWalletConnectOptions'

describe('buildOwnerWalletConnectList', () => {
  it('prefers standard WalletConnect by default without dedicated metamask entry', () => {
    expect(buildOwnerWalletConnectList({ prefersWalletConnectQr: false })).toEqual([
      'coinbase_wallet',
      'base_account',
      'wallet_connect',
      'detected_ethereum_wallets',
    ])
  })

  it('switches to WalletConnect QR when requested', () => {
    expect(buildOwnerWalletConnectList({ prefersWalletConnectQr: true })).toEqual([
      'coinbase_wallet',
      'base_account',
      'wallet_connect_qr',
      'detected_ethereum_wallets',
    ])
  })
})

describe('mapOwnerWalletConnectError', () => {
  it('maps hanging MetaMask messages to actionable fallback copy', () => {
    expect(mapOwnerWalletConnectError(new Error('Waiting for MetaMask... connect only one wallet at a time'))).toContain(
      'Wallet connection stalled.',
    )
  })

  it('passes through non-specialized messages', () => {
    expect(mapOwnerWalletConnectError(new Error('Failed to connect owner wallet.'))).toBe(
      'Failed to connect owner wallet.',
    )
  })
})
