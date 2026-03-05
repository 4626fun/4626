import { describe, expect, it } from 'vitest'

import { prepareAddOwnerTx } from './coinbaseSmartWalletOwner'

describe('coinbaseSmartWalletOwner.prepareAddOwnerTx', () => {
  it('encodes addOwnerAddress calldata with canonical selector', () => {
    const tx = prepareAddOwnerTx(
      '0x00000000000000000000000000000000000000aA',
      '0x00000000000000000000000000000000000000bB',
    )

    expect(tx.chainId).toBe(8453)
    expect(tx.to).toBe('0x00000000000000000000000000000000000000AA')
    expect(tx.value).toBe('0x0')
    expect(tx.data.startsWith('0x0f0f3f24')).toBe(true)
    expect(tx.data).toBe('0x0f0f3f2400000000000000000000000000000000000000000000000000000000000000bb')
  })

  it('throws on invalid addresses', () => {
    expect(() => prepareAddOwnerTx('0x123', '0x00000000000000000000000000000000000000bB')).toThrow(
      /invalid csw address/i,
    )
  })
})
