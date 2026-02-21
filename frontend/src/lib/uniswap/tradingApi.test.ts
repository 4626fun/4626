import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertValidSwapTransaction,
  buildSwap,
  fetchTradeQuote,
  pickPermitData,
  toPermitSignPayload,
  type TradeQuoteRequest,
} from './tradingApi'

const VALID_TX = {
  to: '0x0000000000000000000000000000000000000001',
  from: '0x0000000000000000000000000000000000000002',
  data: '0x1234',
  chainId: 8453,
}

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
          json: async () => ({ success: true, data: { requestId: 'rq_123', routing: 'CLASSIC' } }),
        }),
    )

    const result = await fetchTradeQuote(quoteRequest('2526'))
    expect(result.requestId).toBe('rq_123')
    expect((globalThis.fetch as any).mock.calls.length).toBe(2)
  })

  it('keys quote cache by wallet mode without forwarding mode key upstream', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { requestId: 'rq_mode', routing: 'CLASSIC' } }),
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
