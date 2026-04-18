/**
 * Unit tests for wrapCswOwnerSignature.
 *
 * Verifies:
 *  - Returns the correct abi-encoded output for a known 65-byte signature + ownerIndex=0
 *  - Supports non-zero ownerIndex
 *  - Throws for a signature that is not exactly 65 bytes
 */

import { describe, expect, it } from 'vitest'
import { decodeAbiParameters } from 'viem'
import { wrapCswOwnerSignature } from './cswOwnerSignature.js'

// A canonical 65-byte (130 hex chars) signature padded to fill the space.
// r (32 bytes) + s (32 bytes) + v (1 byte) = 65 bytes.
const SIG_65 = ('0x' + 'ab'.repeat(32) + 'cd'.repeat(32) + 'ff') as `0x${string}`

describe('wrapCswOwnerSignature', () => {
  it('returns abi-encoded output for a 65-byte signature with ownerIndex=0 (default)', () => {
    const result = wrapCswOwnerSignature(SIG_65)

    // Decode the result and verify the fields round-trip correctly.
    const [decodedIndex, decodedSig] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      result,
    )
    expect(decodedIndex).toBe(0n)
    expect(decodedSig.toLowerCase()).toBe(SIG_65.toLowerCase())
  })

  it('encodes non-zero ownerIndex correctly', () => {
    const result = wrapCswOwnerSignature(SIG_65, 2)

    const [decodedIndex, decodedSig] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      result,
    )
    expect(decodedIndex).toBe(2n)
    expect(decodedSig.toLowerCase()).toBe(SIG_65.toLowerCase())
  })

  it('returns a hex string starting with 0x', () => {
    const result = wrapCswOwnerSignature(SIG_65)
    expect(result.startsWith('0x')).toBe(true)
  })

  it('throws for a signature that is too short (< 65 bytes)', () => {
    // 64 bytes = 128 hex chars + 0x prefix = 130 total chars.
    const shortSig = ('0x' + 'ab'.repeat(64)) as `0x${string}`
    expect(() => wrapCswOwnerSignature(shortSig)).toThrow(/65-byte/)
  })

  it('throws for a signature that is too long (> 65 bytes)', () => {
    // 66 bytes = 132 hex chars + 0x prefix = 134 total chars.
    const longSig = ('0x' + 'ab'.repeat(66)) as `0x${string}`
    expect(() => wrapCswOwnerSignature(longSig)).toThrow(/65-byte/)
  })

  it('throws when ownerSignature does not start with 0x', () => {
    // Same byte count but missing 0x prefix — length 130, not 132.
    const noPrefix = ('ab'.repeat(65)) as `0x${string}`
    expect(() => wrapCswOwnerSignature(noPrefix)).toThrow(/65-byte/)
  })
})
