import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from '../helpers'

const readRequestPrincipalAddressMock = vi.hoisted(() => vi.fn(() => '0x00000000000000000000000000000000000000aa'))

vi.mock('../../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: (...args: unknown[]) => readRequestPrincipalAddressMock(...args),
}))

async function loadQuoteHandler() {
  const mod = await import('../../_handlers/uniswap/_quote.ts')
  return mod.default
}

describe('/api/uniswap/quote policy guards', () => {
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

  it('rejects token denylisted by server env', async () => {
    restoreEnv = applyEnv({
      UNISWAP_API_KEY: 'test-key',
      UNISWAP_TOKEN_DENYLIST: '0x0000000000000000000000000000000000000001',
    })

    const handler = await loadQuoteHandler()
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.9' },
      body: {
        tokenIn: '0x0000000000000000000000000000000000000001',
        tokenOut: '0x0000000000000000000000000000000000000002',
        tokenInChainId: 8453,
        tokenOutChainId: 8453,
        type: 'EXACT_INPUT',
        amount: '1',
        swapper: '0x0000000000000000000000000000000000000003',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toMatch(/denied/i)
  })

  it('rejects disallowed routing returned by upstream', async () => {
    restoreEnv = applyEnv({
      UNISWAP_API_KEY: 'test-key',
      UNISWAP_ALLOWED_ROUTE_TYPES: 'CLASSIC',
    })

    const fetchMock = vi.fn(async () => ({
      status: 200,
      text: async () =>
        JSON.stringify({
          requestId: 'rq_blocked',
          routing: 'PRIORITY',
          quote: { output: { amount: '1' } },
          permitData: null,
        }),
    }))
    vi.stubGlobal('fetch', fetchMock as any)

    const handler = await loadQuoteHandler()
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.10' },
      body: {
        tokenIn: '0x0000000000000000000000000000000000000001',
        tokenOut: '0x0000000000000000000000000000000000000002',
        tokenInChainId: 8453,
        tokenOutChainId: 8453,
        type: 'EXACT_INPUT',
        amount: '1',
        swapper: '0x0000000000000000000000000000000000000003',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(422)
    expect(String(res.body?.error ?? '')).toMatch(/routing/i)
  })
})
