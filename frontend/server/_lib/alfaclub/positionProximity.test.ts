import { describe, expect, it } from 'vitest'

import {
  computeLiquidationProximityPct,
  computeTargetProgressPct,
  estimateMarkPrice,
} from './positionProximity.js'
import { parseHermitAlertCommandArgs } from './positionAlertStore.js'

describe('positionProximity', () => {
  it('estimates mark from entry, notional, and pnl', () => {
    const mark = estimateMarkPrice({
      entryPx: 100,
      positionValueUsd: 10_000,
      unrealizedPnlUsd: 500,
      side: 'long',
    })
    expect(mark).toBeCloseTo(105, 4)
  })

  it('computes long liquidation distance', () => {
    const pct = computeLiquidationProximityPct({
      markPrice: 100,
      liquidationPrice: 90,
      side: 'long',
    })
    expect(pct).toBeCloseTo(10, 4)
  })

  it('computes target progress', () => {
    expect(computeTargetProgressPct(4_500, 5_000)).toBe(90)
    expect(computeTargetProgressPct(-100, 5_000)).toBe(0)
  })
})

describe('parseHermitAlertCommandArgs', () => {
  it('parses liq and target commands', () => {
    expect(parseHermitAlertCommandArgs('liq 10')).toEqual({ action: 'liq', pct: 10 })
    expect(parseHermitAlertCommandArgs('target 5000')).toEqual({ action: 'target', usd: 5000 })
    expect(parseHermitAlertCommandArgs('telegram on')).toEqual({ action: 'telegram', enabled: true })
    expect(parseHermitAlertCommandArgs('test')).toEqual({ action: 'test' })
    expect(parseHermitAlertCommandArgs('off')).toEqual({ action: 'off' })
  })

  it('bare alert enables defaults', () => {
    expect(parseHermitAlertCommandArgs('')).toEqual({ action: 'default' })
    expect(parseHermitAlertCommandArgs('on')).toEqual({ action: 'default' })
    expect(parseHermitAlertCommandArgs('status')).toEqual({ action: 'status' })
  })
})
