import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const fetchZoraTradeQuote = vi.hoisted(() => vi.fn())
const readRequestPrincipalAddress = vi.hoisted(() => vi.fn())
const checkDurableRateLimit = vi.hoisted(() => vi.fn())
const getClientIp = vi.hoisted(() => vi.fn(() => '1.2.3.4'))

vi.mock('../../server/_lib/zora/zoraTradeQuote.js', () => ({
  fetchZoraTradeQuote,
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@4626/server-core')
  return {
    ...actual,
    readRequestPrincipalAddress,
    checkDurableRateLimit,
    getClientIp,
    rateLimitKey: (...parts: string[]) => parts.join(':'),
    RATE_LIMITS: { general: { windowMs: 60_000, maxRequests: 60 } },
    handleOptions: () => false,
    setCors: () => {},
    setNoStore: () => {},
  }
})

import handler from '../_handlers/zora/_tradeQuote'

function mockRes() {
  const res: Partial<VercelResponse> & { body?: unknown; statusCode?: number } = {}
  res.status = vi.fn((code: number) => {
    res.statusCode = code
    return res as VercelResponse
  })
  res.json = vi.fn((body: unknown) => {
    res.body = body
    return res as VercelResponse
  })
  res.setHeader = vi.fn()
  return res as VercelResponse & { body?: unknown; statusCode?: number }
}

describe('POST /api/zora/tradeQuote auth', () => {
  beforeEach(() => {
    fetchZoraTradeQuote.mockReset()
    readRequestPrincipalAddress.mockReset()
    checkDurableRateLimit.mockReset()
    checkDurableRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    })
  })

  it('allows unauthenticated pricing quotes with IP rate limiting', async () => {
    readRequestPrincipalAddress.mockReturnValue('')
    fetchZoraTradeQuote.mockResolvedValue({
      call: {
        target: '0x6ff5693b99212da76ad316178a184ab56d299b43',
        data: '0x1234',
        value: '1',
      },
      quote: { amountOut: '42' },
    })

    const req = {
      method: 'POST',
      body: {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        amountIn: '1000000000000000',
        sender: '0x0000000000000000000000000000000000000001',
        slippage: 0.01,
        preview: true,
      },
      headers: {},
    } as unknown as VercelRequest
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ success: true })
    expect(checkDurableRateLimit).toHaveBeenCalledWith(
      'zora-trade-quote:anon:1.2.3.4',
      expect.anything(),
      expect.anything(),
    )
    expect(fetchZoraTradeQuote).toHaveBeenCalledWith(
      expect.objectContaining({ allowAmountOutOnly: true }),
    )
  })

  it('still quotes when authenticated', async () => {
    readRequestPrincipalAddress.mockReturnValue('0x1111111111111111111111111111111111111111')
    fetchZoraTradeQuote.mockResolvedValue({
      call: {
        target: '0x6ff5693b99212da76ad316178a184ab56d299b43',
        data: '0x1234',
        value: '1',
      },
      quote: { amountOut: '42' },
    })
    const req = {
      method: 'POST',
      body: {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        amountIn: '1000000000000000',
        sender: '0x1111111111111111111111111111111111111111',
        slippage: 0.01,
      },
      headers: {},
    } as unknown as VercelRequest
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(checkDurableRateLimit).toHaveBeenCalledWith(
      'zora-trade-quote:0x1111111111111111111111111111111111111111:1.2.3.4',
      expect.anything(),
      expect.anything(),
    )
  })
})
