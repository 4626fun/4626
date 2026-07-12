import { describe, expect, it } from 'vitest'
import { previewBribeClaim, shortAddress } from './bribePreview'

describe('previewBribeClaim', () => {
  it('returns 0 when any weight or bag is zero', () => {
    expect(previewBribeClaim({ totalBribes: 100n, userWeight: 0n, vaultWeight: 50n })).toBe(0n)
    expect(previewBribeClaim({ totalBribes: 0n, userWeight: 10n, vaultWeight: 50n })).toBe(0n)
    expect(previewBribeClaim({ totalBribes: 100n, userWeight: 10n, vaultWeight: 0n })).toBe(0n)
  })

  it('splits pro-rata', () => {
    // alice 50 of 100 vault weight → half of 1000 bag
    expect(
      previewBribeClaim({ totalBribes: 1000n, userWeight: 50n, vaultWeight: 100n }),
    ).toBe(500n)
  })

  it('floors dust', () => {
    expect(
      previewBribeClaim({ totalBribes: 3n, userWeight: 1n, vaultWeight: 2n }),
    ).toBe(1n)
  })
})

describe('shortAddress', () => {
  it('truncates 0x addresses', () => {
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678')
  })
})
