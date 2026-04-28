import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from '../helpers'

const readRequestPrincipalAddressMock = vi.hoisted(
  () => vi.fn((..._args: unknown[]) => '0x00000000000000000000000000000000000000aa'),
)

vi.mock('../../../server/_lib/auth/requestPrincipal.js', () => ({
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
    vi.unstubAllGlobals()
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

  it('strips stale Permit2 fields before forwarding when Permit2 is disabled', async () => {
    restoreEnv = applyEnv({
      UNISWAP_API_KEY: 'test-key',
      UNISWAP_TRADE_API_BASE: 'https://trade.example.test/v1',
    })
    const fetchMock = vi.fn(async () => ({
      status: 200,
      text: async () =>
        JSON.stringify({
          swap: {
            to: '0x0000000000000000000000000000000000000001',
            from: '0x0000000000000000000000000000000000000002',
            data: '0x1234',
            value: '0',
            chainId: 8453,
          },
        }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const handler = await loadSwapHandler()
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.101' },
      body: {
        permit2Disabled: true,
        permitData: { domain: {}, values: {} },
        signature: '0xabc',
        quote: {
          input: { token: '0x0000000000000000000000000000000000000001', amount: '1' },
          output: { token: '0x0000000000000000000000000000000000000002', amount: '1' },
          routing: 'CLASSIC',
          permitData: { stale: true },
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const forwardedRequest = (fetchMock as any).mock.calls[0]?.[1]
    const forwarded = JSON.parse(String(forwardedRequest?.body ?? '{}'))
    expect(forwarded.permit2Disabled).toBeUndefined()
    expect(forwarded.permitData).toBeUndefined()
    expect(forwarded.signature).toBeUndefined()
    expect(forwarded.quote.permitData).toBeUndefined()
    expect(forwardedRequest?.headers).toMatchObject({ 'x-permit2-disabled': 'true' })
  })
})
