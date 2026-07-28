import { describe, expect, it } from 'vitest'

import {
  evaluateOracleLaunchPreflight,
  impliedFdvEthFromWeiPerToken,
  usesZoraV4MarketFloorCrossCheck,
} from './oracleLaunchPreflight'

describe('usesZoraV4MarketFloorCrossCheck', () => {
  it('runs for Creator Coin deploys only', () => {
    expect(usesZoraV4MarketFloorCrossCheck('creator')).toBe(true)
    expect(usesZoraV4MarketFloorCrossCheck('agent')).toBe(false)
  })
})

describe('evaluateOracleLaunchPreflight', () => {
  const nowSec = 1_785_000_000
  const market = 5_509_209_377_511n

  it('passes when oracle is fresh and within the market-floor band', () => {
    expect(
      evaluateOracleLaunchPreflight({
        oracleAssetUsd1e18: market,
        oracleUpdatedAtSec: nowSec - 60,
        marketFloorUsd1e18: market,
        nowSec,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects a missing or zero oracle print', () => {
    const result = evaluateOracleLaunchPreflight({
      oracleAssetUsd1e18: 0n,
      oracleUpdatedAtSec: nowSec,
      marketFloorUsd1e18: market,
      nowSec,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/no fresh asset USD/i)
  })

  it('rejects a stale oracle beyond MAX_STALENESS', () => {
    const result = evaluateOracleLaunchPreflight({
      oracleAssetUsd1e18: market,
      oracleUpdatedAtSec: nowSec - 7201,
      marketFloorUsd1e18: market,
      nowSec,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/stale/i)
  })

  it('rejects oracle prints that diverge more than the configured band', () => {
    // 50% above market floor — well past the 20% launch band.
    const tooHigh = (market * 15_000n) / 10_000n
    const result = evaluateOracleLaunchPreflight({
      oracleAssetUsd1e18: tooHigh,
      oracleUpdatedAtSec: nowSec - 60,
      marketFloorUsd1e18: market,
      nowSec,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/diverges/i)
  })
})

describe('impliedFdvEthFromWeiPerToken', () => {
  it('scales wei/token to a 1B-supply ETH FDV', () => {
    expect(impliedFdvEthFromWeiPerToken({ weiPerToken: 3_000_000_000n })).toBeCloseTo(3, 6)
  })
})
