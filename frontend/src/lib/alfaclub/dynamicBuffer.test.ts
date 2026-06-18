import { describe, expect, it } from 'vitest'

import { calculateOptimalBufferAction, generateEfficiencyCurve } from './dynamicBuffer'

describe('generateEfficiencyCurve', () => {
  it('builds a full curve with deterministic shape', () => {
    const points = generateEfficiencyCurve(1000, 20, 60)
    expect(points).toHaveLength(61)
    expect(points[0]).toEqual({
      drawdownPct: 0,
      marginalEfficiency: 0.5,
      health: 1,
      recommendedAdd: 80,
      efficiencyScore: 0.6,
    })
    expect(points.at(-1)?.drawdownPct).toBe(5)
    expect(points.at(-1)?.health).toBeGreaterThanOrEqual(0.08)
    expect(points.at(-1)?.marginalEfficiency).toBeGreaterThan(points[0]!.marginalEfficiency)
  })

  it('defaults to safe minimum bounds for bad args', () => {
    const points = generateEfficiencyCurve(0, 0, 0)
    expect(points).toHaveLength(2)
    expect(points[0]?.drawdownPct).toBe(0)
    expect(points[1]?.drawdownPct).toBe(5)
  })
})

describe('calculateOptimalBufferAction', () => {
  it('recommends add in critical drawdown zone', () => {
    const action = calculateOptimalBufferAction({
      margin: 1000,
      buffer: 1200,
      notional: 20_000,
      health: 0.4,
      entryPrice: 100,
      currentPrice: 95,
      isLong: true,
      usedBuffer: 100,
    })
    expect(action).not.toBeNull()
    expect(action?.type).toBe('ADD')
    expect(action?.amount).toBeGreaterThanOrEqual(80)
    expect(action?.newHealth).toBeGreaterThan(0.4)
    expect(action?.newBuffer).toBeLessThan(1200)
  })

  it('recommends trim after favorable move with healthy leg', () => {
    const action = calculateOptimalBufferAction({
      margin: 1000,
      buffer: 600,
      notional: 20_000,
      health: 1.3,
      entryPrice: 100,
      currentPrice: 98,
      isLong: false,
    })
    expect(action).not.toBeNull()
    expect(action?.type).toBe('TRIM')
    expect(action?.amount).toBeGreaterThan(0)
    expect(action?.newBuffer).toBeGreaterThan(600)
    expect(action?.newHealth).toBeLessThan(1.3)
  })

  it('returns null when no threshold is met', () => {
    const action = calculateOptimalBufferAction({
      margin: 1000,
      buffer: 1000,
      notional: 20_000,
      health: 0.95,
      entryPrice: 100,
      currentPrice: 99.6,
      isLong: true,
      usedBuffer: 600,
    })
    expect(action).toBeNull()
  })

  it('returns null for invalid leg inputs', () => {
    const action = calculateOptimalBufferAction({
      margin: 0,
      buffer: 1000,
      notional: 20_000,
      health: 0.7,
      entryPrice: 100,
      currentPrice: 96,
      isLong: true,
    })
    expect(action).toBeNull()
  })
})
