import { describe, expect, it } from 'vitest'

import {
  normalizeExactWrapTokenName,
  normalizeExactWrapTokenSymbol,
  normalizeWrapTokenName,
  normalizeWrapTokenSymbol,
  WRAP_TOKEN_NAME_MAX_LENGTH,
  WRAP_TOKEN_SYMBOL_MAX_LENGTH,
} from './solanaBridgeTokenMetadata'

describe('normalizeWrapTokenName', () => {
  it('lowercase-coerces mixed-case input so Solana display is uniform', () => {
    expect(normalizeWrapTokenName('MyCoin')).toBe('mycoin')
    expect(normalizeWrapTokenName('AKITA')).toBe('akita')
    expect(normalizeWrapTokenName('Zora Creator Coin')).toBe('zora creator coin')
  })

  it('passes already-lowercase input through unchanged', () => {
    expect(normalizeWrapTokenName('akita')).toBe('akita')
    expect(normalizeWrapTokenName('creator share')).toBe('creator share')
  })

  it('rejects empty, null, undefined, and non-string values', () => {
    expect(normalizeWrapTokenName('')).toBe(null)
    expect(normalizeWrapTokenName(null as unknown as string)).toBe(null)
    expect(normalizeWrapTokenName(undefined as unknown as string)).toBe(null)
  })

  it('rejects names containing null bytes', () => {
    expect(normalizeWrapTokenName('bad\u0000name')).toBe(null)
  })

  it('rejects names that exceed the 32-char limit before lowercasing', () => {
    const tooLong = 'A'.repeat(WRAP_TOKEN_NAME_MAX_LENGTH + 1)
    expect(normalizeWrapTokenName(tooLong)).toBe(null)
  })

  it('rejects names that exceed the 32-byte UTF-8 limit after lowercasing', () => {
    // Turkish capital dotted I (\u0130) is 2 UTF-8 bytes but lowercases to
    // "i\u0307" (3 bytes). Construct a string that passes the pre-lowercase
    // byte check but overflows after case folding.
    const tricky = `\u0130`.repeat(11) // 11 chars, 22 bytes, lowers to 33 bytes
    expect(Buffer.byteLength(tricky, 'utf8')).toBeLessThanOrEqual(WRAP_TOKEN_NAME_MAX_LENGTH)
    expect(Buffer.byteLength(tricky.toLowerCase(), 'utf8')).toBeGreaterThan(WRAP_TOKEN_NAME_MAX_LENGTH)
    expect(normalizeWrapTokenName(tricky)).toBe(null)
  })

  it('accepts names at exactly the 32-char limit', () => {
    const exactly32 = 'a'.repeat(WRAP_TOKEN_NAME_MAX_LENGTH)
    expect(normalizeWrapTokenName(exactly32)).toBe(exactly32)
  })
})

describe('normalizeWrapTokenSymbol', () => {
  it('lowercase-coerces mixed-case symbols', () => {
    expect(normalizeWrapTokenSymbol('AKITA')).toBe('akita')
    expect(normalizeWrapTokenSymbol('Sol')).toBe('sol')
    expect(normalizeWrapTokenSymbol('USDC')).toBe('usdc')
  })

  it('passes lowercase symbols through unchanged', () => {
    expect(normalizeWrapTokenSymbol('akita')).toBe('akita')
  })

  it('rejects empty, null-byte, and oversized symbols', () => {
    expect(normalizeWrapTokenSymbol('')).toBe(null)
    expect(normalizeWrapTokenSymbol('bad\u0000')).toBe(null)
    expect(normalizeWrapTokenSymbol('A'.repeat(WRAP_TOKEN_SYMBOL_MAX_LENGTH + 1))).toBe(null)
  })

  it('rejects symbols whose lowercase form overflows 12 UTF-8 bytes', () => {
    const tricky = `\u0130`.repeat(6) // 6 chars, 12 bytes, lowers to 18 bytes
    expect(Buffer.byteLength(tricky, 'utf8')).toBeLessThanOrEqual(WRAP_TOKEN_SYMBOL_MAX_LENGTH)
    expect(Buffer.byteLength(tricky.toLowerCase(), 'utf8')).toBeGreaterThan(WRAP_TOKEN_SYMBOL_MAX_LENGTH)
    expect(normalizeWrapTokenSymbol(tricky)).toBe(null)
  })

  it('accepts symbols at exactly the 12-char limit', () => {
    const exactly12 = 'a'.repeat(WRAP_TOKEN_SYMBOL_MAX_LENGTH)
    expect(normalizeWrapTokenSymbol(exactly12)).toBe(exactly12)
  })
})

describe('deprecated aliases', () => {
  // These aliases let consumers that still import the old "Exact" names
  // keep working while the rename stabilizes. Behavior is identical to the
  // renamed functions -- both coerce to lowercase despite "Exact" in the name.
  it('normalizeExactWrapTokenName still works and coerces to lowercase', () => {
    expect(normalizeExactWrapTokenName('MyCoin')).toBe('mycoin')
    expect(normalizeExactWrapTokenName).toBe(normalizeWrapTokenName)
  })

  it('normalizeExactWrapTokenSymbol still works and coerces to lowercase', () => {
    expect(normalizeExactWrapTokenSymbol('AKITA')).toBe('akita')
    expect(normalizeExactWrapTokenSymbol).toBe(normalizeWrapTokenSymbol)
  })
})
