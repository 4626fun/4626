import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes, withAuthHeader } from '../helpers'

async function loadOrderHandler() {
  const mod = await import('../../_handlers/uniswap/_order.ts')
  return mod.default
}

async function loadSwap5792Handler() {
  const mod = await import('../../_handlers/uniswap/_swap5792.ts')
  return mod.default
}

async function loadSwap7702Handler() {
  const mod = await import('../../_handlers/uniswap/_swap7702.ts')
  return mod.default
}

const ALLOWED_TOP_LEVEL_TOKENS = {
  tokenIn: '0x0000000000000000000000000000000000000002',
  tokenOut: '0x0000000000000000000000000000000000000003',
}

const DENIED_NESTED_TOKENS = {
  input: { token: '0x0000000000000000000000000000000000000001', amount: '1' },
  output: { token: '0x0000000000000000000000000000000000000004', amount: '1' },
}

describe('uniswap handlers block nested quote token bypass', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    restoreEnv = applyEnv({
      UNISWAP_TOKEN_DENYLIST: '0x0000000000000000000000000000000000000001',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('rejects nested denied token in /api/uniswap/order quote', async () => {
    const handler = await loadOrderHandler()
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader({ origin: 'https://app.4626.fun', 'x-forwarded-for': '10.2.0.1' }),
      body: {
        signature: '0xabc',
        quote: {
          ...ALLOWED_TOP_LEVEL_TOKENS,
          ...DENIED_NESTED_TOKENS,
          routing: 'CLASSIC',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Token denied by policy: input.token')
  })

  it('rejects nested denied token in /api/uniswap/swap_5792 classicQuote', async () => {
    const handler = await loadSwap5792Handler()
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader({ origin: 'https://app.4626.fun', 'x-forwarded-for': '10.2.0.2' }),
      body: {
        deadline: Date.now() + 60_000,
        classicQuote: {
          ...ALLOWED_TOP_LEVEL_TOKENS,
          ...DENIED_NESTED_TOKENS,
          routing: 'CLASSIC',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Token denied by policy: input.token')
  })

  it('rejects nested denied token in /api/uniswap/swap_7702 classicQuote', async () => {
    const handler = await loadSwap7702Handler()
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader({ origin: 'https://app.4626.fun', 'x-forwarded-for': '10.2.0.3' }),
      body: {
        smartContractDelegationAddress: '0x0000000000000000000000000000000000000005',
        classicQuote: {
          ...ALLOWED_TOP_LEVEL_TOKENS,
          ...DENIED_NESTED_TOKENS,
          routing: 'CLASSIC',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Token denied by policy: input.token')
  })
})
