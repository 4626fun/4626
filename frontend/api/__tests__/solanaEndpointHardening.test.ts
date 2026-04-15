import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  checkRateLimitMock,
  getClientIpMock,
  readRequestPrincipalAddressMock,
  getDbMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  checkRateLimitMock: vi.fn(() => ({ allowed: false, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '203.0.113.42'),
  readRequestPrincipalAddressMock: vi.fn(() => '0x0000000000000000000000000000000000000001'),
  getDbMock: vi.fn(async () => null),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: readJsonBodyMock,
  readJsonBody: readJsonBodyMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  RATE_LIMITS: {
    solanaRouteProvision: { windowMs: 60_000, maxRequests: 20 },
    solanaSetCanonical: { windowMs: 60_000, maxRequests: 30 },
    solanaSweepEnqueue: { windowMs: 60_000, maxRequests: 20 },
    solanaSweepProcess: { windowMs: 60_000, maxRequests: 30 },
    smartWalletOwnerRead: { windowMs: 60_000, maxRequests: 120 },
  },
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  getClientIp: getClientIpMock,
}))

vi.mock('../../server/_lib/auth/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipal: vi.fn(async () => null),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  isDbConfigured: vi.fn(() => true),
  getDb: getDbMock,
}))

describe('solana/deploy endpoint hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: false, resetAt: Date.now() + 60_000 })
    getClientIpMock.mockReturnValue('203.0.113.42')
    readRequestPrincipalAddressMock.mockReturnValue('0x0000000000000000000000000000000000000001')
    getDbMock.mockResolvedValue(null)
  })

  it('rate-limits provisionSolanaRoute after machine auth', async () => {
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET = 'secret'
    const { default: handler } = await import('../_handlers/deploy/_provisionSolanaRoute.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: { bridgeToken: '0x0000000000000000000000000000000000000001' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many provision requests')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('passes explicit max body bytes for provisionSolanaRoute parsing', async () => {
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET = 'secret'
    checkRateLimitMock.mockReturnValueOnce({ allowed: true, resetAt: Date.now() + 60_000 })
    const { default: handler } = await import('../_handlers/deploy/_provisionSolanaRoute.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(readJsonBodyMock).toHaveBeenCalledWith(req, { maxBytes: 16_384 })
    expect(res.statusCode).toBe(400)
  })

  it('rate-limits solana canonical wallet mutation', async () => {
    const { default: handler } = await import('../_handlers/wallet/solana/_setCanonical.ts')
    const req = createMockReq({ method: 'POST', body: { wallet: '11111111111111111111111111111111' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many canonical wallet updates')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('rate-limits solana sweep enqueue requests', async () => {
    const { default: handler } = await import('../_handlers/wallet/solana/sweep/_enqueue.ts')
    const req = createMockReq({ method: 'POST', body: { minLamports: 1 } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many sweep requests')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('rate-limits solana sweep processor trigger', async () => {
    process.env.SOLANA_SWEEP_PROCESSOR_SECRET = 'processor-secret'
    const { default: handler } = await import('../_handlers/wallet/solana/sweep/_process.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer processor-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many processor requests')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('rate-limits smart-wallet owner read endpoints', async () => {
    const { default: ownerHandler } = await import('../_handlers/deploy/_smartWalletOwner.ts')
    const { default: ownersHandler } = await import('../_handlers/deploy/_smartWalletOwners.ts')
    const ownerReq = createMockReq({
      method: 'POST',
      body: {
        smartWallet: '0x0000000000000000000000000000000000000001',
        ownerAddress: '0x0000000000000000000000000000000000000002',
      },
    })
    const ownerRes = createMockRes()
    await ownerHandler(ownerReq, ownerRes)

    const ownersReq = createMockReq({
      method: 'GET',
      query: { smartWallet: '0x0000000000000000000000000000000000000001' },
    })
    const ownersRes = createMockRes()
    await ownersHandler(ownersReq, ownersRes)

    expect(ownerRes.statusCode).toBe(429)
    expect(ownersRes.statusCode).toBe(429)
    expect(String(ownerRes.body?.error ?? '')).toContain('Too many owner checks')
    expect(String(ownersRes.body?.error ?? '')).toContain('Too many owner checks')
  })
})
