import { describe, expect, it } from 'vitest'

import { lensUriFromGroveUrl } from '../lens/lensGrove.js'

import {
  __integrityCardTestables,
  buildIntegrityCardTree,
  INTEGRITY_CARD_CANVAS,
} from './integrityCardTemplate.js'
import type { Scorecard } from './scorecard.js'

const {
  formatUsd,
  formatPct,
  formatInt,
  formatThirtyDayPnl,
  toneFromNumber,
  podiumLabel,
  formatSnapshotDate,
  shortHash,
  truncate,
} = __integrityCardTestables

function sampleScorecard(overrides?: Partial<Scorecard>): Scorecard {
  return {
    schema: '4626.alfaclub.scorecard.v1',
    generatedAt: '2026-07-18T12:01:42.880Z',
    snapshotTs: '2026-07-18T12:00:51.529Z',
    disclaimer: 'test',
    publisher: {
      agentId: 2205,
      agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
      canonicalCsw: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    },
    creator: {
      address: '0x940e6d3964a48180365e38a1013ba19ad1f3c6c8',
      tokenId: '2',
    },
    metrics: {
      totalSupply: '86',
      stakedSupply: '62',
      hyperliquid: {
        accountValueUsd: 547.97,
        pnl30dUsd: 10.21,
      },
    },
    scores: {
      popularity: 0.3739,
      performance: 0,
      composite: 0.1496,
      rank: 1,
      totalRanked: 1698,
    },
    citations: {
      friendKeyContract: '0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F',
      friendStakeBeacon: '0x53BdEfB3E2faEB90b766B459AF96F3E357D3c3f9',
      friendPool: '0xa1bf9bb17C283CF17F01516f78f3127D2C84C79d',
      hyperliquidInfoUrl: 'https://api.hyperliquid.xyz/info',
    },
    ...overrides,
  }
}

describe('integrityCardTemplate helpers', () => {
  it('formats bullish chip values and tones', () => {
    expect(formatUsd(10.21)).toBe('$10')
    expect(formatUsd(40_000)).toBe('$40.0K')
    expect(formatUsd(140_000)).toBe('$140K')
    expect(formatUsd(12_400)).toBe('$12.4K')
    expect(formatPct(50.02)).toBe('+50.0%')
    expect(formatPct(-0.31)).toBe('-0.31%')
    expect(formatInt(39)).toBe('39')
    expect(toneFromNumber(12)).toBe('positive')
    expect(toneFromNumber(-3)).toBe('negative')
    expect(podiumLabel(1)).toBe('DAILY LEAD')
    expect(formatThirtyDayPnl({
      fundUsd: 1_000,
      holders: 10,
      pnlPctAllTime: 50,
      pnlPct30d: 19.8,
      pnl30dUsd: 6_500,
      pnlUsd: 500,
    })).toBe('$6.5K')
  })

  it('formats snapshot day and grove crumbs', () => {
    expect(formatSnapshotDate('2026-07-18T12:00:51.529Z')).toBe('2026-07-18')
    expect(shortHash('lens://46d3cc8d3bed5a45056146835a3684e56e08101a8a097a5205d64963045acc76'))
      .toBe('46d3cc…cc76')
    expect(truncate('Flip Research Desk Extra Long Name', 12)).toBe('Flip Resear…')
  })

  it('derives lens:// provenance from Grove gateway URLs', () => {
    const hash = '46d3cc8d3bed5a45056146835a3684e56e08101a8a097a5205d64963045acc76'
    expect(lensUriFromGroveUrl(`https://api.grove.storage/${hash}`)).toBe(`lens://${hash}`)
    expect(lensUriFromGroveUrl(`https://api.grove.storage/${hash.toUpperCase()}`)).toBe(`lens://${hash}`)
    expect(lensUriFromGroveUrl('https://example.com/not-grove')).toBeNull()
  })
})

describe('buildIntegrityCardTree', () => {
  it('builds a polished ranked card with glass deck and reporter mark', () => {
    const tree = buildIntegrityCardTree({
      scorecard: sampleScorecard(),
      visuals: {
        displayName: 'Flip Research',
        handle: 'Flip_Research',
        roomName: 'Flip Trades',
        scorecardUri: 'lens://46d3cc8d3bed5a45056146835a3684e56e08101a8a097a5205d64963045acc76',
      },
      roomMetrics: {
        fundUsd: 40_000,
        holders: 120,
        pnlPctAllTime: 128.4,
        pnlPct30d: 22.1,
        pnl30dUsd: 7_200,
        pnlUsd: 18_000,
      },
    })

    expect(tree.type).toBe('div')
    expect(tree.props.style?.width).toBe(INTEGRITY_CARD_CANVAS.width)
    expect(tree.props.style?.height).toBe(INTEGRITY_CARD_CANVAS.height)

    const serialized = JSON.stringify(tree)
    expect(serialized).toContain('#1')
    expect(serialized).toContain('DAILY LEAD')
    expect(serialized).toContain('Flip Research')
    expect(serialized).toContain('@Flip_Research')
    expect(serialized).toContain('$40.0K')
    expect(serialized).toContain('120')
    expect(serialized).toContain('+128%')
    expect(serialized).toContain('$7.2K')
    expect(serialized).toContain('composite 0.150')
    expect(serialized).toContain('INTEGRITY SNAPSHOT')
    expect(serialized).toContain('hermit4626')
    expect(serialized).toContain('REPORTED BY')
    expect(serialized).toContain('1,698 ranked')
    expect(serialized).not.toContain('4626 Keepr')
  })

  it('labels live room metrics day when it differs from scorecard snapshotTs', () => {
    const tree = buildIntegrityCardTree({
      scorecard: sampleScorecard(),
      visuals: {
        displayName: 'Flip Research',
        handle: 'Flip_Research',
        roomName: 'Flip Trades',
        scorecardUri: 'lens://46d3cc8d3bed5a45056146835a3684e56e08101a8a097a5205d64963045acc76',
        roomMetricsAsOf: '2026-07-19T08:15:00.000Z',
      },
      roomMetrics: {
        fundUsd: 40_000,
        holders: 120,
        pnlPctAllTime: 128.4,
        pnlPct30d: 22.1,
        pnl30dUsd: 7_200,
        pnlUsd: 18_000,
      },
    })

    const serialized = JSON.stringify(tree)
    expect(serialized).toContain('2026-07-18')
    expect(serialized).toContain('room 2026-07-19')
    expect(serialized).toContain('46d3cc…cc76')
  })
})
