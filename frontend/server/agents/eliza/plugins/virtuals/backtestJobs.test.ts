import { describe, expect, it, vi } from 'vitest'

import {
  parseBacktestRequestFromText,
  parseBacktestRequestFromOffering,
  parseFundingOiRegimeRequestFromOffering,
  parseSignalRequestFromText,
  parseSignalRequestFromOffering,
  runFundingOiRegimeJob,
  runRealBacktestJob,
  runCounterTradeSignal,
} from './backtestJobs.js'

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
      windowHours: 2160,
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
      windowHours: 2160,
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
      windowHours: 2160,
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
      windowHours: 2160,
    })
  })

  it('parses 7d window from text', () => {
    const parsed = parseBacktestRequestFromText('backtest BTC 7d capital 4000')
    expect(parsed?.windowHours).toBe(168)
  })

  it('parses 30d window from text', () => {
    const parsed = parseBacktestRequestFromText('backtest ETH 30d capital 4000')
    expect(parsed?.windowHours).toBe(720)
  })

  it('parses offering-name-style window hint (backtestReport7d)', () => {
    const parsed = parseBacktestRequestFromText('generateBacktestReport7d BTC capital 4000')
    expect(parsed?.windowHours).toBe(168)
  })

  it('clamps window to minimum 1 day', () => {
    const parsed = parseBacktestRequestFromText('backtest BTC 1d capital 4000')
    expect(parsed?.windowHours).toBe(24)
  })
})

describe('parseBacktestRequestFromOffering', () => {
  it('parses 7d offering with JSON requirements', () => {
    const req = parseBacktestRequestFromOffering('generateBacktestReport7d', '{"symbol":"BTC"}')
    expect(req).not.toBeNull()
    expect(req?.symbol).toBe('BTC')
    expect(req?.windowHours).toBe(168) // 7 * 24
  })

  it('parses 30d offering with JSON requirements', () => {
    const req = parseBacktestRequestFromOffering('generateBacktestReport30d', '{"symbol":"ETH","leveragePercent":40}')
    expect(req).not.toBeNull()
    expect(req?.symbol).toBe('ETH')
    expect(req?.windowHours).toBe(720) // 30 * 24
    expect(req?.leveragePercent).toBe(40)
  })

  it('parses 90d offering with JSON requirements', () => {
    const req = parseBacktestRequestFromOffering('generateBacktestReport90d', '{"symbol":"SOL","rebalanceHealthPercent":80,"rebalanceSizePercent":25}')
    expect(req).not.toBeNull()
    expect(req?.symbol).toBe('SOL')
    expect(req?.windowHours).toBe(2160) // 90 * 24
    expect(req?.rebalanceHealthPercent).toBe(80)
    expect(req?.rebalanceSizePercent).toBe(25)
  })

  it('returns null for non-backtest offering names', () => {
    expect(parseBacktestRequestFromOffering('counterTradeSignal', '{"symbol":"BTC"}')).toBeNull()
    expect(parseBacktestRequestFromOffering('someOtherOffering', '{"symbol":"BTC"}')).toBeNull()
  })

  it('returns null when requirement JSON has no symbol', () => {
    expect(parseBacktestRequestFromOffering('generateBacktestReport7d', '{"request":"hello"}')).toBeNull()
  })

  it('handles non-JSON requirement text by extracting symbol', () => {
    const req = parseBacktestRequestFromOffering('generateBacktestReport7d', 'BTC')
    expect(req).not.toBeNull()
    expect(req?.symbol).toBe('BTC')
    expect(req?.windowHours).toBe(168)
  })

  it('normalizes symbol formats', () => {
    const req = parseBacktestRequestFromOffering('generateBacktestReport7d', '{"symbol":"btcusd"}')
    expect(req?.symbol).toBe('BTC')
  })
})

describe('parseSignalRequestFromOffering', () => {
  it('parses counterTradeSignal offering with symbol', () => {
    expect(parseSignalRequestFromOffering('counterTradeSignal', '{"symbol":"BTC"}')).toBe('BTC')
  })

  it('returns null for non-signal offering names', () => {
    expect(parseSignalRequestFromOffering('generateBacktestReport7d', '{"symbol":"BTC"}')).toBeNull()
  })

  it('handles non-JSON requirement text', () => {
    expect(parseSignalRequestFromOffering('counterTradeSignal', 'ETH')).toBe('ETH')
  })

  it('returns null when no symbol in JSON', () => {
    expect(parseSignalRequestFromOffering('counterTradeSignal', '{"request":"hello"}')).toBeNull()
  })
})

describe('funding/OI shadow offering', () => {
  it('only parses the dedicated offering schema', () => {
    expect(parseFundingOiRegimeRequestFromOffering('fundingOiRegimeShadow', '{"symbol":"eth"}')).toBe('ETH')
    expect(parseFundingOiRegimeRequestFromOffering('counterTradeSignal', '{"symbol":"ETH"}')).toBeNull()
    expect(parseFundingOiRegimeRequestFromOffering('fundingOiRegimeShadow', '{"request":"hello"}')).toBeNull()
  })

  it('runs read-only analysis and returns explicitly advisory output', async () => {
    const readMarketContext = vi.fn().mockResolvedValue({
      symbol: 'BTC',
      markPriceUsd: 100_000,
      priceChange24hPct: 3,
      fundingRate: 0.0002,
      openInterestUsd: 900_000,
      volume24hUsd: 1_000_000,
    })
    const result = await runFundingOiRegimeJob('BTC', { readMarketContext })

    expect(readMarketContext).toHaveBeenCalledWith('BTC')
    expect(result.regime).toBe('crowded-longs')
    expect(result.shadowOnly).toBe(true)
    expect(result.responseText).toContain('Advisory only')
    expect(result.responseText).not.toMatch(/\b(COUNTER|DELAY|SKIP)\b/)
  })

  it('best-effort records the observation and settles due horizons without changing analysis', async () => {
    const context = {
      symbol: 'BTC',
      markPriceUsd: 100_000,
      priceChange24hPct: 3,
      fundingRate: 0.0002,
      openInterestUsd: 900_000,
      volume24hUsd: 1_000_000,
    }
    const readMarketContext = vi.fn().mockResolvedValue(context)
    const recordObservation = vi.fn().mockRejectedValue(new Error('shadow store unavailable'))
    const settleHorizons = vi.fn().mockResolvedValue({ due: 2, settled: 2, deferred: 0 })

    const result = await runFundingOiRegimeJob('BTC', {
      readMarketContext,
      recordObservation,
      settleHorizons,
      now: () => 1_752_321_600_000,
    })

    expect(recordObservation).toHaveBeenCalledWith(expect.objectContaining({
      observedAtMs: 1_752_321_600_000,
      symbol: 'BTC',
      markPriceUsd: 100_000,
      regime: 'crowded-longs',
      fundingBias: 'longs-paying',
      confidence: result.confidence,
    }))
    expect(settleHorizons).toHaveBeenCalledWith({
      nowMs: 1_752_321_600_000,
      readMarkPriceAt: expect.any(Function),
    })
    expect(result.regime).toBe('crowded-longs')
    expect(result.responseText).toContain('Advisory only')
  })

  it('fails closed when market context is unavailable', async () => {
    const result = await runFundingOiRegimeJob('BTC', {
      readMarketContext: vi.fn().mockResolvedValue(null),
    })
    expect(result.regime).toBe('insufficient-data')
    expect(result.responseText).toContain('INSUFFICIENT-DATA')
  })

  it('passes the stable ACP job key through to observation persistence', async () => {
    const recordObservation = vi.fn().mockResolvedValue({ observationId: 'observation-1', inserted: true })

    await runFundingOiRegimeJob('BTC', {
      idempotencyKey: 'virtuals:8453:job-123',
      readMarketContext: vi.fn().mockResolvedValue({
        symbol: 'BTC',
        markPriceUsd: 100_000,
        priceChange24hPct: 3,
        fundingRate: 0.0002,
        openInterestUsd: 900_000,
        volume24hUsd: 1_000_000,
      }),
      recordObservation,
      settleHorizons: vi.fn().mockResolvedValue({ due: 0, settled: 0, deferred: 0 }),
    })

    expect(recordObservation).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'virtuals:8453:job-123',
    }))
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
        windowHours: 2160,
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

  it('surfaces warning when 1m cache unavailable and interval degrades', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: 'line1\nline2',
      resolvedInterval: '5m',
      sweepBasename: null,
      series: null,
    })
    const resolveLeverage = vi.fn().mockResolvedValue({ appliedLeverage: 5, maxLeverage: 10 })
    const result = await runRealBacktestJob(
      {
        symbol: 'ETH',
        leveragePercent: 50,
        rebalanceHealthPercent: 75,
        rebalanceSizePercent: 35,
        initialLongUsd: 1000,
        initialShortUsd: 1000,
        windowHours: 2160,
      },
      { run: run as never, resolveLeverage: resolveLeverage as never },
    )
    expect(result.resolvedInterval).toBe('5m')
    expect(result.responseText).toContain('WARNING: 1m cache unavailable')
    expect(result.responseText).toContain('Resolved interval: 5m')
  })
})

describe('parseSignalRequestFromText', () => {
  it('returns null for non-signal messages', () => {
    expect(parseSignalRequestFromText('hello there')).toBeNull()
  })

  it('returns null for backtest messages (backtest handler takes those)', () => {
    expect(parseSignalRequestFromText('please backtest BTC 7d')).toBeNull()
  })

  it('parses signal request with symbol', () => {
    expect(parseSignalRequestFromText('give me a signal for BTC')).toBe('BTC')
  })

  it('parses counter-trade request', () => {
    expect(parseSignalRequestFromText('counter-trade bias for ETH')).toBe('ETH')
  })

  it('parses zag request', () => {
    expect(parseSignalRequestFromText('zag SOL')).toBe('SOL')
  })

  it('returns null when no symbol found', () => {
    expect(parseSignalRequestFromText('give me a signal')).toBeNull()
  })
})

describe('runCounterTradeSignal', () => {
  it('derives short-bias signal when price went up', async () => {
    const csvHeader = 'symbol,interval,windowHours,leverage,healthFloor,deadband,minChunkUsd,maxChunkUsd,cooldownBars,startPrice,endPrice,priceChangePct,finalEquity,realizedPnl,executionCost,rebalanceCount,avgChunkUsd,finalLongQty,finalShortQty,finalLongNotionalUsd,finalShortNotionalUsd,minHealthRoom,minHealthAgent,forcedSkipsInsufficientBuffer,commingleViolationCount,liquidationCount,objective'
    const csvRow = 'BTC,1m,168,20,0.75,0.08,100,100,3,95000.0000,98000.0000,3.15789474,1010.5000,10.5000,2.3000,5,100.0000,0.00490,0.00488,480.20,478.24,0.42,0.38,0,0,0,10.5'
    const run = vi.fn().mockResolvedValue({
      stdout: `${csvHeader}\n${csvRow}\n`,
      resolvedInterval: '1m',
      sweepBasename: null,
      series: null,
    })
    const resolveLeverage = vi.fn().mockResolvedValue({ appliedLeverage: 20, maxLeverage: 40 })
    const result = await runCounterTradeSignal('BTC', {
      run: run as never,
      resolveLeverage: resolveLeverage as never,
    })
    expect(result.signal).toBe('short-bias')
    expect(result.conviction).toBeGreaterThan(0)
    expect(result.responseText).toContain('SHORT-BIAS')
    expect(result.responseText).toContain('BTC')
    expect(result.responseText).toContain('conviction')
  })

  it('derives long-bias signal when price went down', async () => {
    const csvHeader = 'symbol,interval,windowHours,leverage,healthFloor,deadband,minChunkUsd,maxChunkUsd,cooldownBars,startPrice,endPrice,priceChangePct,finalEquity,realizedPnl,executionCost,rebalanceCount,avgChunkUsd,finalLongQty,finalShortQty,finalLongNotionalUsd,finalShortNotionalUsd,minHealthRoom,minHealthAgent,forcedSkipsInsufficientBuffer,commingleViolationCount,liquidationCount,objective'
    const csvRow = 'ETH,1m,168,10,0.75,0.08,100,100,3,3500.0000,3300.0000,-5.71428571,990.2000,-9.8000,1.5000,3,100.0000,0.02840,0.02780,185.20,181.50,0.45,0.41,0,0,0,-9.8'
    const run = vi.fn().mockResolvedValue({
      stdout: `${csvHeader}\n${csvRow}\n`,
      resolvedInterval: '1m',
      sweepBasename: null,
      series: null,
    })
    const resolveLeverage = vi.fn().mockResolvedValue({ appliedLeverage: 10, maxLeverage: 20 })
    const result = await runCounterTradeSignal('ETH', {
      run: run as never,
      resolveLeverage: resolveLeverage as never,
    })
    expect(result.signal).toBe('long-bias')
    expect(result.conviction).toBeGreaterThan(0)
    expect(result.responseText).toContain('LONG-BIAS')
  })

  it('derives neutral signal when price change is small', async () => {
    const csvHeader = 'symbol,interval,windowHours,leverage,healthFloor,deadband,minChunkUsd,maxChunkUsd,cooldownBars,startPrice,endPrice,priceChangePct,finalEquity,realizedPnl,executionCost,rebalanceCount,avgChunkUsd,finalLongQty,finalShortQty,finalLongNotionalUsd,finalShortNotionalUsd,minHealthRoom,minHealthAgent,forcedSkipsInsufficientBuffer,commingleViolationCount,liquidationCount,objective'
    const csvRow = 'SOL,1m,168,5,0.75,0.08,100,100,3,180.0000,181.0000,0.55555556,500.2000,0.2000,0.1000,1,100.0000,2.7800,2.7700,501.40,499.80,0.50,0.48,0,0,0,0.2'
    const run = vi.fn().mockResolvedValue({
      stdout: `${csvHeader}\n${csvRow}\n`,
      resolvedInterval: '1m',
      sweepBasename: null,
      series: null,
    })
    const resolveLeverage = vi.fn().mockResolvedValue({ appliedLeverage: 5, maxLeverage: 10 })
    const result = await runCounterTradeSignal('SOL', {
      run: run as never,
      resolveLeverage: resolveLeverage as never,
    })
    expect(result.signal).toBe('neutral')
    expect(result.conviction).toBe(0)
    expect(result.responseText).toContain('NEUTRAL')
  })

  it('handles missing CSV gracefully with defaults', async () => {
    const run = vi.fn().mockResolvedValue({
      stdout: 'some non-csv output\n',
      resolvedInterval: '5m',
      sweepBasename: null,
      series: null,
    })
    const resolveLeverage = vi.fn().mockResolvedValue({ appliedLeverage: 20, maxLeverage: 40 })
    const result = await runCounterTradeSignal('BTC', {
      run: run as never,
      resolveLeverage: resolveLeverage as never,
    })
    expect(result.signal).toBe('neutral')
    expect(result.conviction).toBe(0)
    expect(result.resolvedInterval).toBe('5m')
  })
})
