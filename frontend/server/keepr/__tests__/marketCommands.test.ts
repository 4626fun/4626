import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyEnv } from '../../../api/__tests__/helpers'

import { handleKeeprCommand } from '../commands.ts'

function mockFetchJsonOnce(payload: any) {
  const res = {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
  ;(fetch as any).mockResolvedValueOnce(res)
}

function mockFetchErrorOnce(params: { status: number; body?: any; statusText?: string }) {
  const body = params.body ?? { detail: 'bad request' }
  const res = {
    ok: false,
    status: params.status,
    statusText: params.statusText ?? 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
  ;(fetch as any).mockResolvedValueOnce(res)
}

describe('/mkt commands', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-22T12:00:00Z'))

    vi.stubGlobal('fetch', vi.fn())
    restoreEnv = applyEnv({
      OPENBB_API_BASE_URL: 'http://openbb.local:6900',
      OPENBB_API_TOKEN: undefined,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns help text', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/mkt help',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Market data commands (OpenBB)')
    expect(result.response).toContain('/mkt quote')
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('returns a clear message when OpenBB is not configured', async () => {
    const restore = applyEnv({ OPENBB_API_BASE_URL: undefined })
    try {
      const result = await handleKeeprCommand({
        groupId: 'group-1',
        senderWallet: '0x00000000000000000000000000000000000000aa',
        text: '/mkt quote AAPL',
      })

      expect(result.ok).toBe(false)
      expect(result.response).toContain('OPENBB_API_BASE_URL')
      expect((fetch as any).mock.calls.length).toBe(0)
    } finally {
      restore()
    }
  })

  it('rejects invalid symbols', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/mkt quote !!!',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('Usage: /mkt quote <symbol>')
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('returns a quote (formatted)', async () => {
    mockFetchJsonOnce({
      results: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NASDAQ',
        last_price: 189.12,
        change: 2.34,
        change_percent: 0.0123,
        prev_close: 186.78,
        open: 188.01,
        high: 190.25,
        low: 187.44,
        volume: 52123000,
        last_timestamp: '2026-02-22T12:00:00Z',
      },
      provider: 'yfinance',
    })

    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/mkt quote AAPL',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Market quote')
    expect(result.response).toContain('AAPL (Apple Inc.)')
    expect(result.response).toContain('last: 189.12')
    expect(result.response).toContain('provider: yfinance')

    const [url] = (fetch as any).mock.calls[0]
    expect(String(url)).toContain('/api/v1/equity/price/quote')
    expect(String(url)).toContain('symbol=AAPL')
  })

  it('returns company news headlines', async () => {
    mockFetchJsonOnce({
      results: [
        { date: '2026-02-21T10:00:00Z', title: 'Apple announces something', url: 'https://example.com/1' },
        { date: '2026-02-20T10:00:00Z', title: 'AAPL follows up', url: 'https://example.com/2' },
      ],
      provider: 'yfinance',
    })

    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/mkt news AAPL 2',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Company news')
    expect(result.response).toContain('AAPL (top 2)')
    expect(result.response).toContain('1) Apple announces something')
    expect(result.response).toContain('https://example.com/1')
  })

  it('summarizes a price history range', async () => {
    mockFetchJsonOnce({
      results: [
        { date: '2026-02-15', open: 100, high: 102, low: 99, close: 100, volume: 1 },
        { date: '2026-02-22', open: 110, high: 111, low: 109, close: 110, volume: 1 },
      ],
      provider: 'yfinance',
    })

    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/mkt chart AAPL 1w',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Chart')
    expect(result.response).toContain('AAPL (1w)')
    expect(result.response).toContain('close: 100.00')
    expect(result.response).toContain('110.00')
    expect(result.response).toContain('(+10.00%)')
  })

  it('returns macro calendar events', async () => {
    mockFetchJsonOnce({
      results: [
        {
          date: '2026-02-22T13:30:00Z',
          country: 'US',
          event: 'CPI',
          importance: 'high',
          unit: '%',
          actual: 3.1,
          consensus: 3.0,
          previous: 3.2,
        },
      ],
      provider: 'fmp',
    })

    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/mkt calendar today',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Macro calendar (2026-02-22..2026-02-22)')
    expect(result.response).toContain('US')
    expect(result.response).toContain('CPI')
    expect(result.response).toContain('actual 3.1%')
  })

  it('surfaces fundamentals-provider errors clearly', async () => {
    mockFetchErrorOnce({
      status: 400,
      body: { detail: 'Missing API key for provider fmp' },
      statusText: 'Bad Request',
    })

    const result = await handleKeeprCommand({
      groupId: 'group-1',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/mkt ratios AAPL',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('provider API keys')
    expect(result.response).toContain('Missing API key')
  })
})

