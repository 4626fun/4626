import { describe, expect, it } from 'vitest'

import {
  isSparklineDbRowFresh,
  parseSparklineValuesFromDb,
  SPARKLINE_DB_TTL_MS,
} from './exploreSparklineCache.js'

describe('exploreSparklineCache', () => {
  it('parses numeric arrays from jsonb', () => {
    expect(parseSparklineValuesFromDb([1, '1.5', 0, -1, 'bad'])).toEqual([1, 1.5])
  })

  it('treats stale sparkline rows as expired', () => {
    const now = Date.parse('2026-05-23T12:00:00.000Z')
    const fresh = new Date(now - SPARKLINE_DB_TTL_MS + 60_000).toISOString()
    const stale = new Date(now - SPARKLINE_DB_TTL_MS - 60_000).toISOString()
    expect(isSparklineDbRowFresh(fresh, now)).toBe(true)
    expect(isSparklineDbRowFresh(stale, now)).toBe(false)
  })
})
