import { describe, expect, it } from 'vitest'

import {
  normalizeSparklineCoinAddresses,
  prioritizeSparklineCandidates,
} from './exploreSparklinePrecompute.js'

describe('exploreSparklinePrecompute helpers', () => {
  it('dedupes and normalizes coin addresses', () => {
    expect(
      normalizeSparklineCoinAddresses([
        '0x1111111111111111111111111111111111111111',
        '0X1111111111111111111111111111111111111111',
        'not-an-address',
      ]),
    ).toEqual(['0x1111111111111111111111111111111111111111'])
  })

  it('prioritizes stale candidates in explore list order', () => {
    const stale = new Set(['0x0000000000000000000000000000000000000002', '0x0000000000000000000000000000000000000001'])
    expect(
      prioritizeSparklineCandidates(
        [
          '0x0000000000000000000000000000000000000001',
          '0x0000000000000000000000000000000000000003',
          '0x0000000000000000000000000000000000000002',
        ],
        stale,
        2,
      ),
    ).toEqual([
      '0x0000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000002',
    ])
  })
})
