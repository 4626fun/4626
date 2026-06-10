/**
 * Unit tests for wrapCswOwnerSignature.
 */

import { describe, expect, it } from 'vitest'
import { wrapCswOwnerSignature } from './cswOwnerSignature.js'
import { parseCoinbaseSignatureWrapper } from '../../../src/lib/wallet/coinbaseSignatureWrapper.js'

const SIG_65 = ('0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + 'ff') as `0x${string}`

describe('wrapCswOwnerSignature', () => {
  it('returns tuple-encoded SignatureWrapper (CSW isValidSignature decodes it)', () => {
    const result = wrapCswOwnerSignature(SIG_65, 18)
    expect(result.startsWith('0x')).toBe(true)
    expect(result.slice(2, 66).toLowerCase()).toBe(
      '0000000000000000000000000000000000000000000000000000000000000020',
    )
    const parsed = parseCoinbaseSignatureWrapper(result)
    expect(parsed?.ownerIndex).toBe(18)
    expect(parsed?.signatureData.toLowerCase()).toBe(SIG_65.toLowerCase())
  })

  it('encodes non-zero ownerIndex correctly', () => {
    const result = wrapCswOwnerSignature(SIG_65, 18)
    const parsed = parseCoinbaseSignatureWrapper(result)
    expect(parsed?.ownerIndex).toBe(18)
    expect(parsed?.signatureData.toLowerCase()).toBe(SIG_65.toLowerCase())
  })

  it('throws for a signature that is not exactly 65 bytes', () => {
    const shortSig = ('0x' + 'ab'.repeat(64)) as `0x${string}`
    expect(() => wrapCswOwnerSignature(shortSig)).toThrow(/65-byte/)
  })
})
