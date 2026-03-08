import { describe, expect, it } from 'vitest'

import { deriveAdminWalletRoles } from './adminWalletRoles'

describe('deriveAdminWalletRoles', () => {
  it('uses session wallet as admin identity', () => {
    const roles = deriveAdminWalletRoles({
      sessionWallet: '0xAb6D5C10b03300326Cd7FaB7267AE192842967b5',
      connectedWallet: null,
    })
    expect(roles).toMatchObject({
      sessionWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      adminWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      executionWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      signingWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      connectedMatchesSession: false,
    })
  })

  it('marks match when connected and session wallets are equal', () => {
    const roles = deriveAdminWalletRoles({
      sessionWallet: '0xAb6D5C10b03300326Cd7FaB7267AE192842967b5',
      connectedWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })
    expect(roles.connectedMatchesSession).toBe(true)
  })

  it('prefers connected wallet as signer/executor when mismatched', () => {
    const roles = deriveAdminWalletRoles({
      sessionWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      connectedWallet: '0x1111111111111111111111111111111111111111',
    })
    expect(roles.connectedMatchesSession).toBe(false)
    expect(roles.adminWallet).toBe('0xab6d5c10b03300326cd7fab7267ae192842967b5')
    expect(roles.executionWallet).toBe('0x1111111111111111111111111111111111111111')
    expect(roles.signingWallet).toBe('0x1111111111111111111111111111111111111111')
  })

  it('drops invalid addresses', () => {
    const roles = deriveAdminWalletRoles({
      sessionWallet: 'not-an-address',
      connectedWallet: '',
    })
    expect(roles).toMatchObject({
      sessionWallet: null,
      connectedWallet: null,
      adminWallet: null,
      executionWallet: null,
      signingWallet: null,
      connectedMatchesSession: false,
    })
  })
})
