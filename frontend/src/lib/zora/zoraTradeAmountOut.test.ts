import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  fetchZoraTradeQuoteFromApi,
  readZoraQuoteAmountOut,
} from './zoraTradeApi'

describe('readZoraQuoteAmountOut', () => {
  it('reads positive amountOut strings', () => {
    expect(
      readZoraQuoteAmountOut({
        call: { target: '0x1', data: '0x', value: '0' },
        quote: { amountOut: '123' },
      }),
    ).toBe(123n)
  })

  it('returns 0 for missing/invalid values', () => {
    expect(readZoraQuoteAmountOut(null)).toBe(0n)
    expect(
      readZoraQuoteAmountOut({
        call: { target: '0x1', data: '0x', value: '0' },
        quote: { amountOut: 'nope' },
      }),
    ).toBe(0n)
  })
})

describe('fetchZoraTradeQuoteFromApi preview mode', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              quote: { amountOut: '999' },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
  })

  it('accepts amountOut-only payloads when allowAmountOutOnly is set', async () => {
    const payload = await fetchZoraTradeQuoteFromApi({
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      tokenOut: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      amountIn: '1000000000000000',
      sender: '0x0000000000000000000000000000000000000001',
      slippagePct: 1,
      allowAmountOutOnly: true,
    })
    expect(readZoraQuoteAmountOut(payload)).toBe(999n)
    const call = (globalThis.fetch as any).mock.calls[0]
    const init = call[1]
    expect(init.credentials).toBe('include')
    const body = JSON.parse(init.body)
    expect(body.preview).toBe(true)
  })
})
