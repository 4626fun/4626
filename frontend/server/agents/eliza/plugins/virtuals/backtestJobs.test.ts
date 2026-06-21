import { describe, expect, it, vi } from 'vitest'

import { parseBacktestRequestFromText, runRealBacktestJob } from './backtestJobs.js'

describe('parseBacktestRequestFromText', () => {
  it('returns null when message is not a backtest request', () => {
    expect(parseBacktestRequestFromText('hello there')).toBeNull()
  })

  it('parses symbol, percentage knobs, and split capital', () => {
    const parsed = parseBacktestRequestFromText(
      'Please backtest ETH leveragePercent 40 rebalanceHealthPercent 70 rebalanceSizePercent 25 capital 4000',
    )
    expect(parsed).toEqual({
      symbol: 'ETH',
      leveragePercent: 40,
      rebalanceHealthPercent: 70,
      rebalanceSizePercent: 25,
      initialLongUsd: 2000,
      initialShortUsd: 2000,
    })
  })

  it('parses explicit long/short capital overrides', () => {
    const parsed = parseBacktestRequestFromText(
      'Run backtest pair BTCUSD long 1500 short 900 leveragePercent 55',
    )
    expect(parsed).toEqual({
      symbol: 'BTC',
      leveragePercent: 55,
      rebalanceHealthPercent: 75,
      rebalanceSizePercent: 35,
      initialLongUsd: 1500,
      initialShortUsd: 900,
    })
  })

  it('parses JSON-like symbol and defaults percentage knobs', () => {
    const parsed = parseBacktestRequestFromText(
      'backtest {"symbol":"MSTR-USDC","capital":4000}',
    )
    expect(parsed).toEqual({
      symbol: 'MSTR',
      leveragePercent: 50,
      rebalanceHealthPercent: 75,
      rebalanceSizePercent: 35,
      initialLongUsd: 2000,
      initialShortUsd: 2000,
    })
  })

  it('parses lowercase bare symbol token fallback', () => {
    const parsed = parseBacktestRequestFromText('please backtest btc leveragePercent 50')
    expect(parsed).toEqual({
      symbol: 'BTC',
      leveragePercent: 50,
      rebalanceHealthPercent: 75,
      rebalanceSizePercent: 35,
      initialLongUsd: 2000,
      initialShortUsd: 2000,
    })
  })
})

describe('runRealBacktestJob', () => {
  it('executes real runner contract with deterministic params', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: 'line1\nline2\nline3',
      resolvedInterval: '1m',
      sweepBasename: null,
      series: null,
    })
    const resolveLeverage = vi.fn().mockResolvedValue({ appliedLeverage: 12, maxLeverage: 24 })
    const result = await runRealBacktestJob(
      {
        symbol: 'BTC',
        leveragePercent: 50,
        rebalanceHealthPercent: 80,
        rebalanceSizePercent: 25,
        initialLongUsd: 1200,
        initialShortUsd: 800,
      },
      { run: run as never, resolveLeverage: resolveLeverage as never },
    )
    expect(run).toHaveBeenCalledTimes(1)
    expect(resolveLeverage).toHaveBeenCalledWith({
      symbol: 'BTC',
      leveragePercent: 50,
    })
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: '1m',
        windowHours: 2160,
        leverage: 12,
        healthFloor: 0.8,
        minChunkUsd: 200,
        maxChunkUsd: 200,
        initialLongMarginUsd: 600,
        initialShortMarginUsd: 400,
        initialLongBufferUsd: 600,
        initialShortBufferUsd: 400,
      }),
    )
    expect(result.resolvedInterval).toBe('1m')
    expect(result.responseText).toContain('Backtest complete for BTC (2160h, 12.00x from 50% of max 24x')
    expect(result.responseText).toContain('Resolved interval: 1m')
  })

  it('fails when strict 1m execution degrades', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: 'line1\nline2',
      resolvedInterval: '5m',
      sweepBasename: null,
      series: null,
    })
    const resolveLeverage = vi.fn().mockResolvedValue({ appliedLeverage: 5, maxLeverage: 10 })
    await expect(
      runRealBacktestJob(
        {
          symbol: 'ETH',
          leveragePercent: 50,
          rebalanceHealthPercent: 75,
          rebalanceSizePercent: 35,
          initialLongUsd: 1000,
          initialShortUsd: 1000,
        },
        { run: run as never, resolveLeverage: resolveLeverage as never },
      ),
    ).rejects.toThrow('1m execution required')
  })
})
