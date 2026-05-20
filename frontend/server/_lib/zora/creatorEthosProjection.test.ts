import { afterEach, describe, expect, it } from 'vitest'

import {
  mergeCreatorEthosScores,
  pickCreatorEthosProjectionRefreshMode,
} from './creatorEthosProjection.js'

describe('mergeCreatorEthosScores', () => {
  it('prefers projection when live score is lower', () => {
    const merged = mergeCreatorEthosScores(
      { creatorAddress: '0xabc', score: 1800, level: 'reputable', source: 'owner_class_csw' },
      { score: 1200, level: 'neutral' },
      'canonical_wallet',
    )
    expect(merged).toEqual({
      score: 1800,
      level: 'reputable',
      source: 'owner_class_csw',
    })
  })

  it('prefers live when live score is higher', () => {
    const merged = mergeCreatorEthosScores(
      { creatorAddress: '0xabc', score: 1200, level: 'neutral', source: 'wallet_cached' },
      { score: 1900, level: 'exemplary' },
      'owner_class_csw',
    )
    expect(merged).toEqual({
      score: 1900,
      level: 'exemplary',
      source: 'owner_class_csw',
    })
  })

  it('returns nulls when both inputs are empty', () => {
    expect(mergeCreatorEthosScores(null, null)).toEqual({
      score: null,
      level: null,
      source: null,
    })
  })
})

describe('pickCreatorEthosProjectionRefreshMode', () => {
  const env = process.env

  afterEach(() => {
    process.env = env
  })

  it('forces full when ETHOS_CREATOR_PROJECTION_MODE=full', () => {
    process.env = { ...env, ETHOS_CREATOR_PROJECTION_MODE: 'full' }
    expect(pickCreatorEthosProjectionRefreshMode('hot')).toBe('full')
    expect(pickCreatorEthosProjectionRefreshMode('main')).toBe('full')
  })

  it('uses fast on hot lane by default', () => {
    process.env = { ...env, ETHOS_CREATOR_PROJECTION_MODE: '' }
    delete process.env.ETHOS_CREATOR_PROJECTION_HOT_USE_FULL
    expect(pickCreatorEthosProjectionRefreshMode('hot')).toBe('fast')
  })
})
