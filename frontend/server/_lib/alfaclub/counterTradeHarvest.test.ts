import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUserFillsByTimeDetailed: vi.fn(),
}))

vi.mock('./hyperliquid.js', () => ({
  getUserFillsByTimeDetailed: mocks.getUserFillsByTimeDetailed,
}))

import {
  formatSignedUsd,
  resolveBotBankedPnlForClose,
  summarizeBankedCloseFills,
  summarizeHarvestFills,
} from './counterTradeHarvest.js'
import type { HyperliquidUserFillDetailed } from './hyperliquid.js'

function makeFill(overrides: Partial<HyperliquidUserFillDetailed>): HyperliquidUserFillDetailed {
  return {
    closedPnl: 0,
    fee: 0,
    time: 1_720_000_000_000,
    coin: 'BTC',
    px: 100,
    sz: 1,
    dir: 'Open Long',
    side: 'long',
    startPosition: 0,
    leverage: null,
    ...overrides,
  }
}

describe('summarizeHarvestFills', () => {
  it('aggregates volume, realized pnl, fees, and round-trip win/loss counts', () => {
    const summary = summarizeHarvestFills({
      walletAddress: '0xbot',
      fills: [
        makeFill({ dir: 'Open Long 5x', px: 100, sz: 2, fee: 0.2 }),
        makeFill({ dir: 'Close Long', closedPnl: 12.5, px: 105, sz: 2, fee: 0.21, startPosition: 2 }),
        makeFill({ dir: 'Open Short 3x', px: 104, sz: 1, fee: 0.1, side: 'short' }),
        makeFill({
          dir: 'Close Short',
          closedPnl: -4.25,
          px: 108,
          sz: 1,
          fee: 0.11,
          side: 'short',
          startPosition: -1,
        }),
      ],
    })

    expect(summary.walletAddress).toBe('0xbot')
    expect(summary.fillCount).toBe(4)
    expect(summary.grossVolumeUsd).toBeCloseTo(200 + 210 + 104 + 108, 6)
    expect(summary.realizedPnlUsd).toBeCloseTo(8.25, 6)
    expect(summary.feesUsd).toBeCloseTo(0.62, 6)
    expect(summary.netRealizedUsd).toBeCloseTo(8.25 - 0.62, 6)
    expect(summary.closingFillCount).toBe(2)
    expect(summary.winningCloses).toBe(1)
    expect(summary.losingCloses).toBe(1)
  })

  it('counts a liquidation as a closing fill', () => {
    const summary = summarizeHarvestFills({
      walletAddress: '0xbot',
      fills: [makeFill({ dir: 'Liquidated Long', closedPnl: -33, fee: 0.5 })],
    })
    expect(summary.closingFillCount).toBe(1)
    expect(summary.losingCloses).toBe(1)
  })

  it('returns an empty summary for null fills', () => {
    const summary = summarizeHarvestFills({ walletAddress: '0xbot', fills: null })
    expect(summary.fillCount).toBe(0)
    expect(summary.grossVolumeUsd).toBe(0)
    expect(summary.netRealizedUsd).toBe(0)
  })
})

describe('summarizeBankedCloseFills', () => {
  const closeSubmittedAtMs = 1_720_000_100_000

  it('sums close fills for the coin at/after submission', () => {
    const banked = summarizeBankedCloseFills({
      coin: 'BTC',
      closeSubmittedAtMs,
      fills: [
        // Older fill from a previous round trip — outside the buffer window.
        makeFill({ dir: 'Close Long', closedPnl: 99, time: closeSubmittedAtMs - 120_000 }),
        makeFill({ dir: 'Close Short', closedPnl: 8.4, fee: 0.3, time: closeSubmittedAtMs + 1_500 }),
        makeFill({ dir: 'Close Short', closedPnl: 4.0, fee: 0.1, time: closeSubmittedAtMs + 1_600 }),
        // Different coin — ignored.
        makeFill({ coin: 'ETH', dir: 'Close Long', closedPnl: 50, time: closeSubmittedAtMs + 2_000 }),
      ],
    })

    expect(banked).not.toBeNull()
    expect(banked?.fillCount).toBe(2)
    expect(banked?.realizedPnlUsd).toBeCloseTo(12.4, 6)
    expect(banked?.feesUsd).toBeCloseTo(0.4, 6)
    expect(banked?.netRealizedUsd).toBeCloseTo(12.0, 6)
  })

  it('returns null when no close fill matches', () => {
    const banked = summarizeBankedCloseFills({
      coin: 'BTC',
      closeSubmittedAtMs,
      fills: [makeFill({ dir: 'Open Long 5x', time: closeSubmittedAtMs + 1_000 })],
    })
    expect(banked).toBeNull()
  })
})

describe('resolveBotBankedPnlForClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the banked summary on the first poll when the fill is present', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([
      makeFill({ dir: 'Close Short', closedPnl: 5.5, fee: 0.2, time: 1_720_000_101_000 }),
    ])

    const banked = await resolveBotBankedPnlForClose({
      botWalletAddress: '0xbot',
      coin: 'BTC',
      closeSubmittedAtMs: 1_720_000_100_000,
      pollDelayMs: 0,
    })

    expect(banked?.netRealizedUsd).toBeCloseTo(5.3, 6)
    expect(mocks.getUserFillsByTimeDetailed).toHaveBeenCalledTimes(1)
  })

  it('retries and returns null when no matching close fill appears', async () => {
    mocks.getUserFillsByTimeDetailed.mockResolvedValue([])

    const banked = await resolveBotBankedPnlForClose({
      botWalletAddress: '0xbot',
      coin: 'BTC',
      closeSubmittedAtMs: 1_720_000_100_000,
      attempts: 3,
      pollDelayMs: 0,
    })

    expect(banked).toBeNull()
    expect(mocks.getUserFillsByTimeDetailed).toHaveBeenCalledTimes(3)
  })

  it('picks up the fill on a later poll', async () => {
    mocks.getUserFillsByTimeDetailed
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeFill({ dir: 'Close Short', closedPnl: 3.3, fee: 0.1, time: 1_720_000_102_000 }),
      ])

    const banked = await resolveBotBankedPnlForClose({
      botWalletAddress: '0xbot',
      coin: 'BTC',
      closeSubmittedAtMs: 1_720_000_100_000,
      attempts: 3,
      pollDelayMs: 0,
    })

    expect(banked?.realizedPnlUsd).toBeCloseTo(3.3, 6)
    expect(mocks.getUserFillsByTimeDetailed).toHaveBeenCalledTimes(2)
  })
})

describe('formatSignedUsd', () => {
  it('formats positive and negative amounts', () => {
    expect(formatSignedUsd(12.4)).toBe('+$12.40')
    expect(formatSignedUsd(-4.05)).toBe('-$4.05')
    expect(formatSignedUsd(0)).toBe('+$0.00')
  })
})
