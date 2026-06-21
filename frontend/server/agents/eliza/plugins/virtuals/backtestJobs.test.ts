import { describe, expect, it, vi } from 'vitest'

import { parseBacktestRequestFromText, runRealBacktestJob } from './backtestJobs.js'

describe('parseBacktestRequestFromText', () => {
  it('returns null when message is not a backtest request', () => {
    expect(parseBacktestRequestFromText('hello there')).toBeNull()
  })

  it('parses symbol, horizon, leverage, and split capital', () => {
    const parsed = parseBacktestRequestFromText(
      'Please backtest ETH for 14 days at 8x leverage with capital 4000',
    )
    expect(parsed).toEqual({
      symbol: 'ETH',
      windowHours: 336,
      leverage: 8,
      initialLongUsd: 2000,
      initialShortUsd: 2000,
      requireOneMinute: false,
    })
  })

  it('parses explicit long/short capital overrides', () => {
    const parsed = parseBacktestRequestFromText('Run backtest pair BTC 72h 5x long 1500 short 900')
    expect(parsed).toEqual({
      symbol: 'BTC',
      windowHours: 72,
      leverage: 5,
      initialLongUsd: 1500,
      initialShortUsd: 900,
      requireOneMinute: false,
    })
  })

  it('parses require1m mode from explicit keywords', () => {
    const parsed = parseBacktestRequestFromText(
      'backtest BTC 90 days leverage 8x capital 4000 require1m=true',
    )
    expect(parsed).toEqual({
      symbol: 'BTC',
      windowHours: 2160,
      leverage: 8,
      initialLongUsd: 2000,
      initialShortUsd: 2000,
      requireOneMinute: true,
    })
  })
})

describe('runRealBacktestJob', () => {
  it('executes real runner contract with deterministic params', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: 'line1\nline2\nline3',
      resolvedInterval: '1h',
      sweepBasename: null,
      series: null,
    })
    const result = await runRealBacktestJob(
      {
        symbol: 'BTC',
        windowHours: 48,
        leverage: 6,
        initialLongUsd: 1200,
        initialShortUsd: 800,
        requireOneMinute: false,
      },
      { run: run as never },
    )
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.resolvedInterval).toBe('1h')
    expect(result.responseText).toContain('Backtest complete for BTC (48h, 6x')
    expect(result.responseText).toContain('Resolved interval: 1h')
  })

  it('fails when 1m-only is requested but resolved interval degrades', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: 'line1\nline2',
      resolvedInterval: '5m',
      sweepBasename: null,
      series: null,
    })
    await expect(
      runRealBacktestJob(
        {
          symbol: 'ETH',
          windowHours: 2160,
          leverage: 5,
          initialLongUsd: 1000,
          initialShortUsd: 1000,
          requireOneMinute: true,
        },
        { run: run as never },
      ),
    ).rejects.toThrow('1m-only requested')
  })
})
