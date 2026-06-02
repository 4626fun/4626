import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getClearinghouseState,
  getHyperliquidSnapshot,
  getUserFills30d,
} from '../../server/_lib/alfaclub/hyperliquid.ts'

const TEST_ADDR = '0x1111111111111111111111111111111111111111'

type MockResponse = {
  ok?: boolean
  status?: number
  headers?: Record<string, string>
  body?: unknown
}

function mockFetchOnce(response: MockResponse | Error) {
  const original = globalThis.fetch
  globalThis.fetch = vi.fn(async () => {
    if (response instanceof Error) throw response
    const text = typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? {})
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      headers: {
        get: (k: string) => (response.headers?.[k.toLowerCase()] ?? null),
      },
      text: async () => text,
    } as unknown as Response
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

function mockFetchSequence(responses: Array<MockResponse | Error>) {
  const original = globalThis.fetch
  let i = 0
  globalThis.fetch = vi.fn(async () => {
    const response = responses[i++] ?? responses[responses.length - 1]
    if (response instanceof Error) throw response
    const text = typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? {})
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      headers: {
        get: (k: string) => (response.headers?.[k.toLowerCase()] ?? null),
      },
      text: async () => text,
    } as unknown as Response
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

describe('hyperliquid — getClearinghouseState', () => {
  let restore: (() => void) | null = null
  afterEach(() => {
    restore?.()
    restore = null
  })

  it('parses marginSummary when Hyperliquid returns a fully-populated payload', async () => {
    restore = mockFetchOnce({
      body: {
        marginSummary: {
          accountValue: '1234.56',
          totalNtlPos: '500',
          totalRawUsd: '500.5',
        },
      },
    })
    const state = await getClearinghouseState(TEST_ADDR)
    expect(state).toEqual({
      accountValueUsd: 1234.56,
      totalNtlPosUsd: 500,
      totalRawUsdUsd: 500.5,
      crossAccountValueUsd: null,
      withdrawableUsd: null,
    })
  })

  it('returns a nullable state object when marginSummary is missing', async () => {
    restore = mockFetchOnce({ body: { unexpected: 'shape' } })
    const state = await getClearinghouseState(TEST_ADDR)
    expect(state).toEqual({
      accountValueUsd: null,
      totalNtlPosUsd: null,
      totalRawUsdUsd: null,
      crossAccountValueUsd: null,
      withdrawableUsd: null,
    })
  })

  it('returns null when the response is not OK', async () => {
    restore = mockFetchOnce({ ok: false, status: 502 })
    const state = await getClearinghouseState(TEST_ADDR)
    expect(state).toBeNull()
  })

  it('returns null when fetch throws (network error)', async () => {
    restore = mockFetchOnce(new Error('ECONNRESET'))
    const state = await getClearinghouseState(TEST_ADDR)
    expect(state).toBeNull()
  })
})

describe('hyperliquid — getUserFills30d', () => {
  let restore: (() => void) | null = null
  afterEach(() => {
    restore?.()
    restore = null
  })

  it('parses a fill array with numeric and string amounts', async () => {
    restore = mockFetchOnce({
      body: [
        { closedPnl: '12.5', fee: '0.1', time: 1_700_000_000_000 },
        { closedPnl: -5, fee: 0.05, time: 1_700_500_000_000 },
        { closedPnl: 'invalid', fee: 0.25, time: 1_700_900_000_000 },
      ],
    })
    const fills = await getUserFills30d(TEST_ADDR, new Date(1_700_000_000_000))
    expect(fills).toEqual([
      { closedPnl: 12.5, fee: 0.1, time: 1_700_000_000_000 },
      { closedPnl: -5, fee: 0.05, time: 1_700_500_000_000 },
      { closedPnl: 0, fee: 0.25, time: 1_700_900_000_000 },
    ])
  })

  it('returns null on non-array responses', async () => {
    restore = mockFetchOnce({ body: { not: 'an array' } })
    const fills = await getUserFills30d(TEST_ADDR)
    expect(fills).toBeNull()
  })

  it('fails open on fetch error', async () => {
    restore = mockFetchOnce(new Error('timeout'))
    const fills = await getUserFills30d(TEST_ADDR)
    expect(fills).toBeNull()
  })
})

describe('hyperliquid — getHyperliquidSnapshot', () => {
  let restore: (() => void) | null = null
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    restore?.()
    restore = null
  })

  it('composes accountValue + realized pnl30d from both reads', async () => {
    restore = mockFetchSequence([
      {
        body: {
          marginSummary: {
            accountValue: '45221',
            totalNtlPos: '10',
            totalRawUsd: '10',
          },
        },
      },
      {
        body: [
          { closedPnl: 1_000, fee: 10, time: 1_700_000_000_000 },
          { closedPnl: -100, fee: 5, time: 1_700_500_000_000 },
        ],
      },
    ])
    const snap = await getHyperliquidSnapshot(TEST_ADDR)
    expect(snap.ok).toBe(true)
    expect(snap.address).toBe(TEST_ADDR.toLowerCase())
    expect(snap.accountValueUsd).toBe(45221)
    // Sum of (closedPnl - fee) = (1000 - 10) + (-100 - 5) = 885
    expect(snap.pnl30dUsd).toBeCloseTo(885, 6)
    expect(snap.fills30d).toBe(2)
    expect(snap.errorReason).toBeNull()
  })

  it('reports ok=false when both Hyperliquid reads fail', async () => {
    restore = mockFetchSequence([
      new Error('state_down'),
      new Error('fills_down'),
    ])
    const snap = await getHyperliquidSnapshot(TEST_ADDR)
    expect(snap.ok).toBe(false)
    expect(snap.errorReason).toBe('hyperliquid_unavailable')
    expect(snap.accountValueUsd).toBeNull()
    expect(snap.pnl30dUsd).toBeNull()
  })

  it('returns partial data when only one endpoint fails', async () => {
    restore = mockFetchSequence([
      {
        body: {
          marginSummary: { accountValue: '1000', totalNtlPos: '0', totalRawUsd: '1000' },
        },
      },
      new Error('fills_timeout'),
    ])
    const snap = await getHyperliquidSnapshot(TEST_ADDR)
    expect(snap.ok).toBe(true)
    expect(snap.accountValueUsd).toBe(1000)
    expect(snap.pnl30dUsd).toBeNull()
    expect(snap.fills30d).toBe(0)
  })
})
