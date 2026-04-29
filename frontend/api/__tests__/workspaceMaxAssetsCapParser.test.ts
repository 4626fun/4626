import { describe, expect, it } from 'vitest'

import { parseMaxAssetsCap } from '../_handlers/v1/workspace/_actions.ts'

describe('parseMaxAssetsCap', () => {
  it('returns undefined when the field is omitted (preserve existing column)', () => {
    const result = parseMaxAssetsCap({})
    expect(result).toEqual({ ok: true, value: undefined })
  })

  it('returns null when the field is explicit null (clear column)', () => {
    expect(parseMaxAssetsCap({ maxAssetsCap: null })).toEqual({ ok: true, value: null })
  })

  it('returns null when the field is an empty string (clear column)', () => {
    expect(parseMaxAssetsCap({ maxAssetsCap: '' })).toEqual({ ok: true, value: null })
    expect(parseMaxAssetsCap({ maxAssetsCap: '   ' })).toEqual({ ok: true, value: null })
  })

  it('returns trimmed digits string for valid decimal uint256 input', () => {
    expect(parseMaxAssetsCap({ maxAssetsCap: '0' })).toEqual({ ok: true, value: '0' })
    expect(parseMaxAssetsCap({ maxAssetsCap: '1000000000000000000' })).toEqual({
      ok: true,
      value: '1000000000000000000',
    })
    expect(parseMaxAssetsCap({ maxAssetsCap: '  42  ' })).toEqual({ ok: true, value: '42' })
  })

  it('rejects non-decimal strings with validation error', () => {
    expect(parseMaxAssetsCap({ maxAssetsCap: 'abc' })).toEqual({
      ok: false,
      error: 'maxAssetsCap must be a non-negative decimal integer string',
    })
    expect(parseMaxAssetsCap({ maxAssetsCap: '-1' })).toEqual({
      ok: false,
      error: 'maxAssetsCap must be a non-negative decimal integer string',
    })
    expect(parseMaxAssetsCap({ maxAssetsCap: '1.5' })).toEqual({
      ok: false,
      error: 'maxAssetsCap must be a non-negative decimal integer string',
    })
    expect(parseMaxAssetsCap({ maxAssetsCap: '0xff' })).toEqual({
      ok: false,
      error: 'maxAssetsCap must be a non-negative decimal integer string',
    })
  })

  it('rejects non-string, non-null values instead of silently clearing', () => {
    const expected = { ok: false, error: 'maxAssetsCap must be a string, null, or omitted' }
    expect(parseMaxAssetsCap({ maxAssetsCap: 42 })).toEqual(expected)
    expect(parseMaxAssetsCap({ maxAssetsCap: true })).toEqual(expected)
    expect(parseMaxAssetsCap({ maxAssetsCap: false })).toEqual(expected)
    expect(parseMaxAssetsCap({ maxAssetsCap: {} })).toEqual(expected)
    expect(parseMaxAssetsCap({ maxAssetsCap: [] })).toEqual(expected)
    expect(parseMaxAssetsCap({ maxAssetsCap: ['1'] })).toEqual(expected)
  })
})
