import { describe, expect, it } from 'vitest'

import { buildCreatorStats, formatAnimatedStatValue, getDiceRollStatDisplay } from './creatorStatsModel'

describe('creatorStatsModel', () => {
  it('builds stats with 24h volume and formatted currency', () => {
    const stats = buildCreatorStats({
      volume24h: '11540',
      totalVolume: '500000',
      marketCap: '198940',
      uniqueHolders: 19817,
      ethosScore: 1647,
      ethosHasPositiveScore: true,
      ethosAccentClass: 'text-emerald-400',
      coinsCreated: 8,
      createdAt: '2025-12-17T12:00:00.000Z',
      volumeWindow: '24h',
    })

    expect(stats).toHaveLength(6)
    const volume = stats.find((s) => s.id === 'volume')
    const marketCap = stats.find((s) => s.id === 'marketCap')
    const holders = stats.find((s) => s.id === 'holders')
    const ethos = stats.find((s) => s.id === 'ethos')
    const coinsCreated = stats.find((s) => s.id === 'coinsCreated')
    const created = stats.find((s) => s.id === 'created')

    expect(volume?.label).toBe('24H volume')
    expect(volume?.display).toBe('$11.54K')
    expect(volume?.raw).toBe(11540)
    expect(marketCap?.display).toBe('$198.94K')
    expect(holders?.display).toBe('19,817')
    expect(ethos?.display).toBe('1647')
    expect(coinsCreated?.display).toBe('8')
    expect(created?.kind).toBe('date')
    expect(created?.display).toMatch(/Dec 17, 2025/)
  })

  it('switches volume label and raw when window is all-time', () => {
    const stats = buildCreatorStats({
      volume24h: '1000',
      totalVolume: '2500000',
      marketCap: '100',
      uniqueHolders: 0,
      ethosScore: null,
      ethosHasPositiveScore: false,
      ethosAccentClass: 'text-zinc-500',
      coinsCreated: 0,
      createdAt: null,
      volumeWindow: 'all',
    })

    const volume = stats.find((s) => s.id === 'volume')
    const ethos = stats.find((s) => s.id === 'ethos')

    expect(volume?.label).toBe('All-time volume')
    expect(volume?.raw).toBe(2500000)
    expect(volume?.display).toBe('$2.50M')
    expect(ethos?.display).toBe('—')
  })

  it('formats animated currency and integer values during tween', () => {
    expect(formatAnimatedStatValue('currency', 11540)).toBe('$11.54K')
    expect(formatAnimatedStatValue('integer', 19817.6)).toBe('19,818')
  })

  it('dice-roll display settles on the final value at full focus', () => {
    const stat = {
      kind: 'currency' as const,
      raw: 11540,
      display: '$11.54K',
    }
    expect(getDiceRollStatDisplay(stat, 0.1, 0)).not.toBe('$11.54K')
    expect(getDiceRollStatDisplay(stat, 1, 0)).toBe('$11.54K')
  })

  it('dice-roll display eases upward during the settle band', () => {
    const stat = {
      kind: 'integer' as const,
      raw: 2890,
      display: '2,890',
    }
    const mid = getDiceRollStatDisplay(stat, 0.75, 2)
    expect(mid).not.toBe('2,890')
    expect(getDiceRollStatDisplay(stat, 0.99, 2)).toBe('2,890')
  })
})
