import { describe, expect, it } from 'vitest'

import { resolveActiveAccount } from './resolveActiveAccount'

describe('resolveActiveAccount', () => {
  it('uses csw as active account when EOA owner prefers smart mode', () => {
    const result = resolveActiveAccount({
      signerType: 'EOA',
      signerAddress: '0x2222222222222222222222222222222222222222',
      cswAddress: '0x1111111111111111111111111111111111111111',
      eoaIsOwnerOfCsw: true,
      preferredMode: 'SMART_WALLET',
    })

    expect(result).toEqual({
      activeAccount: '0x1111111111111111111111111111111111111111',
      activeAccountType: 'SMART_WALLET',
      canUseSmartWalletMode: true,
    })
  })

  it('uses signer as active account when connected directly as smart wallet', () => {
    const result = resolveActiveAccount({
      signerType: 'SMART_WALLET',
      signerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      cswAddress: undefined,
      eoaIsOwnerOfCsw: null,
      preferredMode: null,
    })

    expect(result).toEqual({
      activeAccount: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      activeAccountType: 'SMART_WALLET',
      canUseSmartWalletMode: true,
    })
  })
})

