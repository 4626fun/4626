import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from '../helpers'

const readRequestPrincipalAddressMock = vi.hoisted(
  () => vi.fn((..._args: unknown[]) => '0x00000000000000000000000000000000000000aa'),
)

vi.mock('../../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

async function loadQuoteHandler() {
  const mod = await import('../../_handlers/uniswap/_quote.ts')
  return mod.default
}

async function loadOrderHandler() {
  const mod = await import('../../_handlers/uniswap/_order.ts')
  return mod.default
}

describe('Uniswap proxy forwards x-erc20eth-enabled header', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
    vi.unstubAllGlobals()
  })

  it('forwards header on /quote when present', async () => {
    restoreEnv = applyEnv({ UNISWAP_API_KEY: 'test-key' })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return {
        status: 200,
        text: async () => JSON.stringify({ requestId: 'rq', routing: 'CLASSIC', quote: {}, permitData: null }),
      } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      headers: {
        origin: 'https://app.4626.fun',
        'x-forwarded-for': '10.1.1.1',
        // The client sends this to our proxy; the proxy should forward upstream.
        'x-erc20eth-enabled': 'true',
      },
      body: {
        tokenIn: '0x0000000000000000000000000000000000000000',
        tokenOut: '0x0000000000000000000000000000000000000001',
        tokenInChainId: 8453,
        tokenOutChainId: 8453,
        type: 'EXACT_INPUT',
        amount: '1',
        swapper: '0x0000000000000000000000000000000000000002',
      },
    })
    const res = createMockRes()
    const handler = await loadQuoteHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0]
    // Sanity check we hit upstream fetch with headers at all.
    expect(init?.headers).toBeTruthy()
    expect((init?.headers as any)?.['x-erc20eth-enabled']).toBe('true')
  })

  it('forwards header on /order when present', async () => {
    restoreEnv = applyEnv({ UNISWAP_API_KEY: 'test-key' })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return {
        status: 201,
        text: async () => JSON.stringify({ requestId: 'req', orderId: 'ord', orderStatus: 'open' }),
      } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      headers: {
        origin: 'https://app.4626.fun',
        'x-forwarded-for': '10.1.1.2',
        'x-erc20eth-enabled': 'true',
      },
      body: {
        signature: '0xabc',
        quote: { encodedOrder: '0x01', orderId: 'q', orderInfo: {} },
      },
    })
    const res = createMockRes()
    const handler = await loadOrderHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0]
    expect((init?.headers as any)?.['x-erc20eth-enabled']).toBe('true')
  })
})

