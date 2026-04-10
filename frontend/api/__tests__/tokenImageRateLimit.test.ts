import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  setPublicCorsMock: vi.fn(),
  getStringQueryMock: vi.fn(),
  getNumberQueryMock: vi.fn(),
  requireServerKeyMock: vi.fn(() => ''),
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(),
  createPublicClientMock: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', () => ({
  DEFAULT_CHAIN_ID: 8453,
  handleOptions: mocks.handleOptionsMock,
  setPublicCors: mocks.setPublicCorsMock,
  requireServerKey: mocks.requireServerKeyMock,
  getStringQuery: mocks.getStringQueryMock,
  getNumberQuery: mocks.getNumberQueryMock,
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  checkRateLimit: (...args: unknown[]) => mocks.checkRateLimitMock(...args),
  getClientIp: (...args: unknown[]) => mocks.getClientIpMock(...args),
  rateLimitKey: (...parts: string[]) => parts.join(':'),
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: mocks.createPublicClientMock,
  }
})

describe('token image endpoint rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStringQueryMock.mockImplementation((_req: any, key: string) => {
      if (key === 'address') return '0x7000000000000000000000000000000000000007'
      return null
    })
    mocks.getNumberQueryMock.mockReturnValue(null)
    mocks.getClientIpMock.mockReturnValue('203.0.113.9')
    mocks.checkRateLimitMock
      .mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 15_000,
      })
      .mockReturnValueOnce({
        allowed: true,
        remaining: 10,
        resetAt: Date.now() + 15_000,
      })
  })

  it('returns 429 before invoking RPC reads when local rate limits are exceeded', async () => {
    const mod = await import('../_handlers/token/_image.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { address: '0x7000000000000000000000000000000000000007' },
      headers: { host: 'v1.4626.fun' },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ error: 'Rate limit exceeded' })
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
    expect(res.getHeader('x-ratelimit-limit')).toBeTruthy()
    expect(mocks.createPublicClientMock).not.toHaveBeenCalled()
  })
})

