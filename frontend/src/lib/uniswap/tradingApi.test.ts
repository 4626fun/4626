import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertValidSwapTransaction,
  buildSwap,
  createOrder,
  fetchTradeQuote,
  isProtocolSwapRouting,
  isUniswapXRouting,
  pickOrderQuote,
  pickSwapQuote,
  pickPermitData,
  toPermitSignPayload,
  type TradeQuoteRequest,
  type TradeQuoteResponse,
} from './tradingApi'
import { MARKETING_ORIGIN } from '@/lib/host'

const VALID_TX = {
  to: '0x0000000000000000000000000000000000000001',
  from: '0x0000000000000000000000000000000000000002',
  data: '0x1234',
  value: '0',
  chainId: 8453,
} as const

function quoteRequest(amount: string): TradeQuoteRequest {
  return {
    tokenIn: '0x0000000000000000000000000000000000000003',
    tokenOut: '0x0000000000000000000000000000000000000004',
    tokenInChainId: 8453,
    tokenOutChainId: 8453,
    type: 'EXACT_INPUT',
    amount,
    swapper: '0x0000000000000000000000000000000000000002',
  }
}

function quoteResponse(routing: string): TradeQuoteResponse {
  return {
    requestId: 'rq_test',
    routing: routing as any,
    quote: { output: { amount: '123' } },
    permitData: null,
  } as any
}

describe('assertValidSwapTransaction', () => {
  it('accepts a well-formed transaction payload', () => {
    expect(() => assertValidSwapTransaction(VALID_TX)).not.toThrow()
  })

  it('rejects missing call data', () => {
    expect(() => assertValidSwapTransaction({ ...VALID_TX, data: '0x' })).toThrow(
      'Invalid swap transaction: missing call data',
    )
  })

  it('rejects mixed legacy and EIP-1559 gas fields', () => {
    expect(() =>
      assertValidSwapTransaction({ ...VALID_TX, maxFeePerGas: '10', gasPrice: '9' }),
    ).toThrow('Invalid swap transaction: cannot set both maxFeePerGas and gasPrice')
  })
})

describe('buildSwap', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires signature and permitData to be provided together', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(
      buildSwap({
        quote: { quoteId: 'q1' },
        signature: '0xabc',
        includeGasInfo: false,
        refreshGasPrice: false,
        simulateTransaction: false,
      }),
    ).rejects.toThrow('Permit2 signature and permitData must be provided together.')
  })

  it('validates swap transaction returned by API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { swap: { ...VALID_TX, data: '0x' } },
        }),
      })),
    )

    await expect(
      buildSwap({
        quote: { quoteId: 'q2' },
        includeGasInfo: false,
        refreshGasPrice: false,
        simulateTransaction: false,
      }),
    ).rejects.toThrow('Invalid swap transaction: missing call data')
  })
})

describe('fetchTradeQuote', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects non-integer amount values', async () => {
    await expect(fetchTradeQuote(quoteRequest('1.23'))).rejects.toThrow(
      'Invalid amount: must be a positive integer in smallest units.',
    )
  })

  it('retries retryable upstream errors and succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ success: false, error: 'temporary network timeout' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { ...quoteResponse('CLASSIC'), requestId: 'rq_123' } }),
        }),
    )

    const result = await fetchTradeQuote(quoteRequest('2526'))
    expect(result.requestId).toBe('rq_123')
    expect((globalThis.fetch as any).mock.calls.length).toBe(2)
  })

  it('keys quote cache by wallet mode without forwarding mode key upstream', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { ...quoteResponse('CLASSIC'), requestId: 'rq_mode' } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const canonicalReq: TradeQuoteRequest = { ...quoteRequest('9101'), walletModeKey: 'canonical' }
    const eoaReq: TradeQuoteRequest = { ...quoteRequest('9101'), walletModeKey: 'eoa' }

    await fetchTradeQuote(canonicalReq)
    await fetchTradeQuote(eoaReq)
    await fetchTradeQuote(canonicalReq)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [firstBody, secondBody] = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body ?? '{}')))
    expect(firstBody.walletModeKey).toBeUndefined()
    expect(secondBody.walletModeKey).toBeUndefined()
  })

  it('falls back to marketing origin when app origin returns 404', async () => {
    const originalWindow = (globalThis as any).window
    ;(globalThis as any).window = { location: { origin: 'https://app.4626.fun' } }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'Not found' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'Not found' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: true, data: { ...quoteResponse('CLASSIC'), requestId: 'rq_cross_origin' } }),
      })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const result = await fetchTradeQuote(quoteRequest('791357'))
      expect(result.requestId).toBe('rq_cross_origin')
      const calledUrls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(calledUrls[0]).toBe('https://app.4626.fun/__api/uniswap/quote')
      expect(calledUrls[1]).toBe('https://app.4626.fun/api/uniswap/quote')
      expect(calledUrls[2]).toBe(`${new URL(MARKETING_ORIGIN).origin}/__api/uniswap/quote`)
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as any).window
      } else {
        ;(globalThis as any).window = originalWindow
      }
    }
  })

  it('surfaces final local 404 payload after alias fallback', async () => {
    const originalWindow = (globalThis as any).window
    ;(globalThis as any).window = { location: { origin: 'http://localhost:5174' } }

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'Alias route not found' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { get: () => 'application/json' },
        json: async () => ({ success: false, error: 'No route for pair' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    try {
      await expect(fetchTradeQuote(quoteRequest('791358'))).rejects.toThrow('No route for pair')
      const calledUrls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(calledUrls).toEqual(['/__api/uniswap/quote', '/api/uniswap/quote'])
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as any).window
      } else {
        ;(globalThis as any).window = originalWindow
      }
    }
  })
})

describe('permit helpers', () => {
  it('picks permit payload from quote response', () => {
    const permitSingleData = { domain: {}, types: {}, values: {} }
    expect(pickPermitData({ permitSingleData } as any)).toEqual(permitSingleData)
  })

  it('normalizes sign payload and infers primary type', () => {
    const payload = toPermitSignPayload({
      domain: { name: 'Permit2', chainId: 8453, verifyingContract: '0x0000000000000000000000000000000000000001' },
      types: {
        EIP712Domain: [{ name: 'name', type: 'string' }],
        PermitSingle: [{ name: 'details', type: 'PermitDetails' }],
      },
      values: { details: { token: '0x0000000000000000000000000000000000000001', amount: '1', expiration: '1', nonce: '1' } },
    })
    expect(payload?.primaryType).toBe('PermitSingle')
    expect(payload?.types.EIP712Domain).toBeUndefined()
    expect(payload?.message.details).toBeTruthy()
  })

  it('returns null for malformed payloads', () => {
    expect(toPermitSignPayload({})).toBeNull()
  })
})

describe('routing helpers', () => {
  it('detects protocol swap routings', () => {
    expect(isProtocolSwapRouting('CLASSIC')).toBe(true)
    expect(isProtocolSwapRouting('WRAP')).toBe(true)
    expect(isProtocolSwapRouting('DUTCH_V2')).toBe(false)
  })

  it('detects UniswapX routings', () => {
    expect(isUniswapXRouting('DUTCH_V2')).toBe(true)
    expect(isUniswapXRouting('PRIORITY')).toBe(true)
    expect(isUniswapXRouting('CLASSIC')).toBe(false)
  })
})

describe('quote pickers', () => {
  it('picks swap quote for protocol routing', () => {
    const resp = quoteResponse('CLASSIC')
    expect(pickSwapQuote(resp)).toEqual((resp as any).quote)
    expect(pickOrderQuote(resp)).toBeNull()
  })

  it('picks order quote for UniswapX routing', () => {
    const resp = {
      ...quoteResponse('DUTCH_V2'),
      quote: { encodedOrder: '0xabc', orderId: 'oid', orderInfo: {} },
    } as any
    expect(pickOrderQuote(resp)).toEqual(resp.quote)
    expect(pickSwapQuote(resp)).toBeNull()
  })
})

describe('createOrder', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts an order to /api/uniswap/order', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { requestId: 'req_o', orderId: 'ord1', orderStatus: 'OPEN' } }),
    }))
    vi.stubGlobal('fetch', fetchMock as any)

    const result = await createOrder({
      signature: '0xabc',
      quote: { encodedOrder: '0x01', orderId: 'ord1', orderInfo: {} },
    })

    expect(result.orderId).toBe('ord1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/uniswap/order')
    expect(init?.method).toBe('POST')
    expect((init?.headers as any)?.['Content-Type']).toBe('application/json')
    const sentBody = JSON.parse(String(init?.body ?? '{}'))
    expect(sentBody.signature).toBe('0xabc')
  })
})
