import { describe, expect, it } from 'vitest'

import type { HyperliquidClearinghouseState } from './hyperliquid.js'
import type { PositionAlertConfig } from './positionAlertStore.js'
import { buildHyperliquidPositionReport } from './positionReport.js'

function makeAlert(overrides: Partial<PositionAlertConfig> = {}): PositionAlertConfig {
  return {
    roomId: 'hyperliquid',
    senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    enabled: true,
    telegramEnabled: true,
    liquidationWarnPct: 10,
    targetPnlUsd: 5000,
    targetProgressPct: 90,
    lastLiqAlertAt: null,
    lastTargetAlertAt: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('buildHyperliquidPositionReport', () => {
  it('includes operator playbook and CTA sections', () => {
    const report = buildHyperliquidPositionReport({
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      hlState: { accountValueUsd: 1000, totalNtlPosUsd: 100, assetPositions: [] },
      alert: makeAlert(),
    })

    expect(report).toContain('📈 **Market read** (alpha analyst mode)')
    expect(report).toContain('Hermit conviction score:')
    expect(report).toContain('✅ **How this prepares you** (operator playbook)')
    expect(report).toContain('🚀 **Action CTA**')
    expect(report).toContain('Defensive bias:')
    expect(report).toContain('`/hermit alert`')
    expect(report).toContain('`/market`')
    expect(report).not.toContain('`/arena status`')
  })

  it('includes room 1659 pulse details and arena lane CTA', () => {
    const hlState: HyperliquidClearinghouseState = {
      accountValueUsd: 683,
      totalNtlPosUsd: 43,
      assetPositions: [
        {
          coin: 'BTC',
          side: 'short',
          entryPx: 67608,
          positionValue: 43,
          unrealizedPnl: 1,
          liquidationPx: 73399.57,
          leverage: 10,
        },
      ],
    }

    const report = buildHyperliquidPositionReport({
      walletAddress: '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2',
      hlState,
      alert: makeAlert(),
      roomId: '1659',
      room1659Market: {
        ok: true,
        hype: 31,
        liquidation: 73399.57,
        roomTotalOpenInterestUsd: 43,
        userPosition: {
          side: 'short',
          unrealizedPnlUsd: 1,
        },
      },
    })

    expect(report).toContain('📡 **Market pulse** (room 1659 context)')
    expect(report).toContain('Hype score: **31/100**')
    expect(report).toContain('Room 1659 HL leg')
    expect(report).toContain('Arena lane check: `/arena status`')
  })

  it('switches CTA tone for aggressive conviction regimes', () => {
    const report = buildHyperliquidPositionReport({
      walletAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      hlState: {
        accountValueUsd: 100,
        totalNtlPosUsd: 500,
        assetPositions: [
          {
            coin: 'ETH',
            side: 'long',
            entryPx: 100,
            positionValue: 500,
            unrealizedPnl: 100,
            liquidationPx: 50,
            leverage: 8,
          },
        ],
      },
      alert: makeAlert(),
      room1659Market: {
        ok: true,
        hype: 90,
        liquidation: 0,
      },
    })

    expect(report).toContain('Aggressive bias:')
  })

  it('adds upstream note when room context is degraded', () => {
    const report = buildHyperliquidPositionReport({
      walletAddress: '0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2',
      hlState: null,
      alert: makeAlert({ enabled: false }),
      roomId: '1659',
      room1659Market: {
        ok: false,
        hype: null,
        liquidation: null,
        errorReason: 'fetch_failed',
      },
    })

    expect(report).toContain('⚠️ **Data source note**')
    expect(report).toContain('retry `/position` in a moment')
  })

  it('includes broader market scope when brief data is supplied', () => {
    const report = buildHyperliquidPositionReport({
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      hlState: { accountValueUsd: 1000, totalNtlPosUsd: 100, assetPositions: [] },
      alert: makeAlert(),
      marketBrief: {
        snapshotTs: '2026-06-03T00:00:00.000Z',
        previousSnapshotTs: '2026-06-02T00:00:00.000Z',
        majors: [
          { symbol: 'BTC', priceUsd: 68000, change24hPct: 2.5 },
          { symbol: 'ETH', priceUsd: 3500, change24hPct: -1.2 },
        ],
        topCreators: [
          { rank: 1, label: 'akita · #1', score: 0.912 },
          { rank: 2, label: 'jesse · #2', score: 0.884 },
        ],
      },
    })

    expect(report).toContain('🌍 **Broader market scope**')
    expect(report).toContain('Majors: BTC')
    expect(report).toContain('Alfa leaders: #1 akita · #1')
  })
})
