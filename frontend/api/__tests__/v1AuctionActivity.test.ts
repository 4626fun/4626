import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const AUCTION = '0x9999999999999999999999999999999999999999'
const CCA_STRATEGY = '0x1111111111111111111111111111111111111111'
const CURRENCY = '0x2222222222222222222222222222222222222222'
const AUCTION_TOKEN = '0x3333333333333333333333333333333333333333'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async (_ctx?: any) => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  readContract: vi.fn(),
  getLogs: vi.fn(),
  getBlockNumber: vi.fn(async () => 15_000_000n),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    auctionRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mocks.readContract,
      getLogs: mocks.getLogs,
      getBlockNumber: mocks.getBlockNumber,
    })),
  }
})

describe('v1 auction activity handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    mocks.getBlockNumber.mockResolvedValue(15_000_000n)

    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'getAuctionStatus':
          return [AUCTION, true, false, 0n, 125_000_000n]
        case 'currency':
          return CURRENCY
        case 'auctionToken':
          return AUCTION_TOKEN
        case 'decimals':
          return 6
        case 'symbol':
          return 'AKITA'
        default:
          return null
      }
    })

    mocks.getLogs.mockResolvedValue([
      {
        blockNumber: 14_999_999n,
        transactionHash: '0xaaa',
        logIndex: 1,
        args: {
          id: 7n,
          owner: '0x4444444444444444444444444444444444444444',
          price: 0n,
          amount: 2_500_000n,
        },
      },
    ])
  })

  it('registers static and dynamic activity routes', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')

    await expect(getV1ApiHandler('auction/activity')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`auction/${CCA_STRATEGY}/activity`)).resolves.toBeTypeOf('function')
  })

  it('returns 429 when auction activity rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const mod = await import('../_handlers/v1/auction/_activity.ts')
    const handler = mod.default
    const req = createMockReq({
      method: 'GET',
      query: { ccaStrategy: CCA_STRATEGY, limit: '3' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
  })

  it('returns normalized live auction activity for a strategy', async () => {
    const mod = await import('../_handlers/v1/auction/_activity.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { ccaStrategy: CCA_STRATEGY, limit: '3' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      ccaStrategy: CCA_STRATEGY.toLowerCase(),
      auction: AUCTION.toLowerCase(),
      isActive: true,
      isGraduated: false,
      currencyRaised: '125000000',
      auctionTokenSymbol: 'AKITA',
      auctionTokenDecimals: 6,
    })
    expect(res.body?.data?.activity).toEqual([
      expect.objectContaining({
        kind: 'bid',
        transactionHash: '0xaaa',
        owner: '0x4444444444444444444444444444444444444444',
        amount: '2500000',
        amountDisplay: '2.5 AKITA',
      }),
    ])
  })

  it('returns an empty activity list when the strategy has no live auction', async () => {
    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'getAuctionStatus':
          return ['0x0000000000000000000000000000000000000000', false, true, 0n, 0n]
        case 'currency':
          return CURRENCY
        case 'auctionToken':
          return AUCTION_TOKEN
        case 'decimals':
          return 6
        case 'symbol':
          return 'AKITA'
        default:
          return null
      }
    })

    const mod = await import('../_handlers/v1/auction/_activity.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { ccaStrategy: CCA_STRATEGY },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.auction).toBeNull()
    expect(res.body?.data?.isActive).toBe(false)
    expect(res.body?.data?.isGraduated).toBe(true)
    expect(res.body?.data?.activity).toEqual([])
    expect(mocks.getLogs).not.toHaveBeenCalled()
  })
})
