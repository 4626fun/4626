import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from '../helpers'

const readRequestPrincipalAddressMock = vi.hoisted(
  () => vi.fn((..._args: unknown[]) => '0x00000000000000000000000000000000000000aa'),
)

vi.mock('../../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

async function loadSwapHandler() {
  const mod = await import('../../_handlers/uniswap/_swap.ts')
  return mod.default
}

describe('/api/uniswap/swap token policy with nested quote tokens', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('rejects denylisted token from quote.input/quote.output', async () => {
    restoreEnv = applyEnv({
      UNISWAP_TOKEN_DENYLIST: '0x0000000000000000000000000000000000000001',
    })

    const handler = await loadSwapHandler()
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.99' },
      body: {
        quote: {
          input: { token: '0x0000000000000000000000000000000000000001', amount: '1' },
          output: { token: '0x0000000000000000000000000000000000000002', amount: '1' },
          routing: 'CLASSIC',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toMatch(/denied/i)
  })

  it('rejects denylisted nested token even when top-level tokenIn/tokenOut are allowed', async () => {
    restoreEnv = applyEnv({
      UNISWAP_TOKEN_DENYLIST: '0x0000000000000000000000000000000000000001',
    })

    const handler = await loadSwapHandler()
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.100' },
      body: {
        quote: {
          tokenIn: '0x0000000000000000000000000000000000000002',
          tokenOut: '0x0000000000000000000000000000000000000003',
          input: { token: '0x0000000000000000000000000000000000000001', amount: '1' },
          output: { token: '0x0000000000000000000000000000000000000004', amount: '1' },
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
