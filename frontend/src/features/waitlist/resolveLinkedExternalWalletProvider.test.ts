import { describe, expect, it } from 'vitest'

import { resolveLinkedExternalWalletProvider } from './resolveLinkedExternalWalletProvider'

describe('resolveLinkedExternalWalletProvider', () => {
  it('prefers the connected Privy wallet snapshot for the linked address', () => {
    expect(
      resolveLinkedExternalWalletProvider({
        linkedAddress: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
        wallets: [{ address: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd', walletClientType: 'metamask' }],
        privyUser: {
          linkedAccounts: [{ address: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd', walletClientType: 'rabby' }],
        },
      }),
    ).toEqual({ provider: 'metamask', connectorId: null })
  })

  it('falls back to linkedAccounts when the wallet snapshot is unavailable', () => {
    expect(
      resolveLinkedExternalWalletProvider({
        linkedAddress: '0xabc1230000000000000000000000000000000000',
        wallets: [],
        privyUser: {
          linkedAccounts: [
            {
              address: '0xabc1230000000000000000000000000000000000',
              walletClientType: 'coinbase_wallet',
            },
          ],
        },
      }),
    ).toEqual({ provider: 'coinbase_wallet', connectorId: null })
  })
})
