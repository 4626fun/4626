import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  readBoundedJsonObjectBody: vi.fn(async (req: any) => req.body ?? null),
  checkRateLimit: vi.fn(() => ({ allowed: false, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '198.51.100.33'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  readJsonBody: mocks.readJsonBody,
  readBoundedJsonObjectBody: mocks.readBoundedJsonObjectBody,
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  logger: mocks.logger,
  RATE_LIMITS: {
    solanaRouteProvision: { windowMs: 60_000, maxRequests: 20 },
    smartWalletOwnerRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

import provisionSolanaRouteHandler from '../_handlers/deploy/_provisionSolanaRoute.ts'
import smartWalletOwnerHandler from '../_handlers/deploy/_smartWalletOwner.ts'
import smartWalletOwnersHandler from '../_handlers/deploy/_smartWalletOwners.ts'

describe('deploy endpoint rate-limit hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.checkRateLimit.mockReturnValue({ allowed: false, resetAt: Date.now() + 60_000 })
    process.env.SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET = 'test-solana-provisioner-secret'
  })

  it('returns 429 + Retry-After for /deploy/provisionSolanaRoute', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-solana-provisioner-secret' },
      body: { bridgeToken: '0x1111111111111111111111111111111111111111' },
    })
    const res = createMockRes()

    await provisionSolanaRouteHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 + Retry-After for /deploy/smartWalletOwner', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        smartWallet: '0x1111111111111111111111111111111111111111',
        ownerAddress: '0x2222222222222222222222222222222222222222',
      },
    })
    const res = createMockRes()

    await smartWalletOwnerHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 429 + Retry-After for /deploy/smartWalletOwners', async () => {
    const req = createMockReq({
      method: 'GET',
      query: { smartWallet: '0x1111111111111111111111111111111111111111' },
    })
    const res = createMockRes()

    await smartWalletOwnersHandler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })
})
