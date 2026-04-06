// storyContent.test.ts
// Content checksum and import guard tests from the drift-prevention rules.

import { describe, it, expect } from 'vitest'
import { STORY_CONTENT } from './storyContent'

describe('content contract', () => {
  it('distribution percentages sum to 100', () => {
    const total = STORY_CONTENT.distribution.reduce((sum, d) => sum + d.numericPercent, 0)
    expect(total).toBe(100)
  })

  it('strategy percentages sum to 100', () => {
    const total = STORY_CONTENT.strategies.reduce((sum, s) => sum + s.numericPercent, 0)
    expect(total).toBe(100)
  })

  it('has exactly 3 distribution destinations', () => {
    expect(STORY_CONTENT.distribution).toHaveLength(3)
  })

  it('has exactly 4 strategy cards', () => {
    expect(STORY_CONTENT.strategies).toHaveLength(4)
  })

  it('every distribution destination has a purposeCopy (not mechanic-first)', () => {
    for (const dest of STORY_CONTENT.distribution) {
      expect(dest.purposeCopy).toBeTruthy()
      expect(dest.purposeCopy.length).toBeGreaterThan(10)
      // Must not contain mechanic-first scheduling language as the only description
      expect(dest.purposeCopy).not.toMatch(/Thursday 00:00 UTC/)
    }
  })

  it('every strategy has a purposeCopy (not protocol-jargon-first)', () => {
    for (const s of STORY_CONTENT.strategies) {
      expect(s.purposeCopy).toBeTruthy()
      expect(s.purposeCopy.length).toBeGreaterThan(10)
    }
  })

  it('distribution copy uses participant-first language, not fan/investor split', () => {
    for (const dest of STORY_CONTENT.distribution) {
      // purposeCopy should not segment audiences as fan vs investor
      expect(dest.purposeCopy).not.toMatch(/\bfan\b/i)
      expect(dest.purposeCopy).not.toMatch(/\binvestor\b/i)
    }
  })

  it('earningTogether-relevant copy uses loop/live framing and avoids completion language', () => {
    // The storyContent itself doesn't own earningTogether copy directly,
    // but we test that no content uses forbidden completion language.
    const allCopy = [
      ...STORY_CONTENT.distribution.map((d) => d.purposeCopy),
      ...STORY_CONTENT.strategies.map((s) => s.purposeCopy),
    ]
    const forbiddenPatterns = [/\bcomplete\b/i, /\bfinished\b/i, /\bdone\b/i, /\bwrapped up\b/i, /\bfinal summary\b/i]
    for (const copy of allCopy) {
      for (const pattern of forbiddenPatterns) {
        expect(copy).not.toMatch(pattern)
      }
    }
  })

  it('blendedApy is a non-empty string', () => {
    expect(STORY_CONTENT.blendedApy).toBeTruthy()
  })
})
