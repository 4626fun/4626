import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/session/_bootstrapSwap.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readDeployAuthFromRequestMock,
  uniswapTradeFetchMock,
  validateRoutePolicyMock,
  validateTokenPolicyMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readDeployAuthFromRequestMock: vi.fn(() => ({ address: '0x00000000000000000000000000000000000000aa' })),
  uniswapTradeFetchMock: vi.fn(),
  validateRoutePolicyMock: vi.fn(() => null),
  validateTokenPolicyMock: vi.fn(() => null),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: readJsonBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/deployAuth.js', () => ({
  readDeployAuthFromRequest: readDeployAuthFromRequestMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  RATE_LIMITS: { general: { windowMs: 60_000, max: 999 } },
  checkRateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((scope: string, ip: string) => `${scope}:${ip}`),
}))

vi.mock('../../server/uniswap/guards.js', () => ({
  validateRoutePolicy: validateRoutePolicyMock,
  validateTokenPolicy: validateTokenPolicyMock,
}))

vi.mock('../../server/uniswap/trading.js', () => ({
  isObject: (value: unknown) => Boolean(value) && typeof value === 'object' && !Array.isArray(value),
  toCleanErrorMessage: (value: unknown, fallback = 'Uniswap request failed') =>
    typeof value === 'string' ? value : fallback,
  uniswapTradeFetch: uniswapTradeFetchMock,
}))

describe('deploy/session/bootstrapSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readDeployAuthFromRequestMock.mockReturnValue({ address: '0x00000000000000000000000000000000000000aa' })
    validateRoutePolicyMock.mockReturnValue(null)
    validateTokenPolicyMock.mockReturnValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function createFetchResponse(status: number, payload: unknown) {
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => JSON.stringify(payload),
    } as any
  }

  it('returns 401 for unauthenticated requests', async () => {
    readDeployAuthFromRequestMock.mockReturnValueOnce(null as any)
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Not authenticated')
  })

  it('builds bootstrap quote/swap plan with 1% default', async () => {
    uniswapTradeFetchMock
      .mockResolvedValueOnce({
        status: 200,
        payload: {
          requestId: 'rq_bootstrap',
          routing: 'CLASSIC',
          quote: {
            tokenIn: '0x0000000000000000000000000000000000000003',
            tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            amount: '100',
            routing: 'CLASSIC',
          },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        payload: {
          swap: {
            to: '0x0000000000000000000000000000000000000005',
            from: '0x0000000000000000000000000000000000000001',
            data: '0x1234',
            value: '0',
          },
        },
      })

    const req = createMockReq({
      method: 'POST',
      body: {
        smartWallet: '0x0000000000000000000000000000000000000001',
        ownerAddress: '0x0000000000000000000000000000000000000001',
        creatorToken: '0x0000000000000000000000000000000000000003',
        creatorAmountBaseUnits: '10000',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.bootstrapBps).toBe(100)
    expect(res.body?.data?.bootstrapCreatorAmountBaseUnits).toBe('100')
    expect(res.body?.data?.tokenOut?.toLowerCase()).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
    expect(uniswapTradeFetchMock).toHaveBeenCalledTimes(2)
    expect(uniswapTradeFetchMock.mock.calls[0]?.[0]?.path).toBe('/quote')
    expect(uniswapTradeFetchMock.mock.calls[1]?.[0]?.path).toBe('/swap')
  })

  it('supports provider=0x and returns 0x swap payload', async () => {
    const fetchMock = vi.fn(async () =>
      createFetchResponse(200, {
        buyAmount: '200',
        sellAmount: '100',
        transaction: {
          to: '0x0000000000000000000000000000000000000005',
          from: '0x0000000000000000000000000000000000000001',
          data: '0x1234',
          value: '0',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        provider: '0x',
        allowFallback: false,
        smartWallet: '0x0000000000000000000000000000000000000001',
        ownerAddress: '0x0000000000000000000000000000000000000001',
        creatorToken: '0x0000000000000000000000000000000000000003',
        creatorAmountBaseUnits: '10000',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.providerUsed).toBe('0x')
    expect(res.body?.data?.fallbackUsed).toBe(false)
    expect(uniswapTradeFetchMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to uniswap when provider=0x fails', async () => {
    const fetchMock = vi.fn(async () =>
      createFetchResponse(502, {
        error: 'upstream down',
      }),
    )
    vi.stubGlobal('fetch', fetchMock as any)

    uniswapTradeFetchMock
      .mockResolvedValueOnce({
        status: 200,
        payload: {
          requestId: 'rq_bootstrap',
          routing: 'CLASSIC',
          quote: {
            tokenIn: '0x0000000000000000000000000000000000000003',
            tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            amount: '100',
            routing: 'CLASSIC',
          },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        payload: {
          swap: {
            to: '0x0000000000000000000000000000000000000005',
            from: '0x0000000000000000000000000000000000000001',
            data: '0x1234',
            value: '0',
          },
        },
      })

    const req = createMockReq({
      method: 'POST',
      body: {
        provider: '0x',
        allowFallback: true,
        smartWallet: '0x0000000000000000000000000000000000000001',
        ownerAddress: '0x0000000000000000000000000000000000000001',
        creatorToken: '0x0000000000000000000000000000000000000003',
        creatorAmountBaseUnits: '10000',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.providerRequested).toBe('0x')
    expect(res.body?.data?.providerUsed).toBe('uniswap')
    expect(res.body?.data?.fallbackUsed).toBe(true)
    expect(Array.isArray(res.body?.data?.providerAttempts)).toBe(true)
    expect(uniswapTradeFetchMock).toHaveBeenCalledTimes(2)
  })
})
