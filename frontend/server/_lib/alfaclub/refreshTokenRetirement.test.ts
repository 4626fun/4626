import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  evaluateRefreshTokenSeed,
  fingerprintRefreshToken,
} from './refreshTokenRetirement.js'

describe('fingerprintRefreshToken', () => {
  it('returns stable sha256 prefix', () => {
    const token = 'opaque-refresh-token-value-12345'
    const expected = createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 32)
    expect(fingerprintRefreshToken(token)).toBe(expected)
  })
})

describe('evaluateRefreshTokenSeed', () => {
  it('rejects a refresh token that was recently retired', () => {
    const fp = fingerprintRefreshToken('stale-refresh-token-abc12345')
    const result = evaluateRefreshTokenSeed({
      candidateFingerprint: fp,
      liveRefreshFingerprint: null,
      retiredFingerprints: [fp],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('stale_refresh_token')
      expect(result.message).toMatch(/fresh triplet/i)
    }
  })

  it('allows re-seeding the currently live refresh token', () => {
    const fp = fingerprintRefreshToken('current-live-refresh-token-abc')
    const result = evaluateRefreshTokenSeed({
      candidateFingerprint: fp,
      liveRefreshFingerprint: fp,
      retiredFingerprints: [fp],
    })
    expect(result).toEqual({ ok: true })
  })

  it('allows a never-seen refresh token', () => {
    const fp = fingerprintRefreshToken('brand-new-refresh-token-xyz98765')
    const result = evaluateRefreshTokenSeed({
      candidateFingerprint: fp,
      liveRefreshFingerprint: null,
      retiredFingerprints: [],
    })
    expect(result).toEqual({ ok: true })
  })
})
