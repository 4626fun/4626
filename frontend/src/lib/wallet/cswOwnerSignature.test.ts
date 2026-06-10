import { describe, expect, it } from 'vitest'

import { parseCoinbaseSignatureWrapper } from '@/lib/wallet/coinbaseSignatureWrapper'
import { wrapCswOwnerSignature } from '@/lib/wallet/cswOwnerSignature'

const SIG_65 = ('0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + 'ff') as `0x${string}`

describe('wrapCswOwnerSignature', () => {
  it('uses tuple encoding expected by Coinbase Smart Wallet isValidSignature', () => {
    const wrapped = wrapCswOwnerSignature(SIG_65, 18)
    expect(wrapped.slice(2, 66).toLowerCase()).toBe(
      '0000000000000000000000000000000000000000000000000000000000000020',
    )
    const parsed = parseCoinbaseSignatureWrapper(wrapped)
    expect(parsed?.ownerIndex).toBe(18)
    expect(parsed?.signatureData.toLowerCase()).toBe(SIG_65.toLowerCase())
  })
})
