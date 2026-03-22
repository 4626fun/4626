import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const CCA_STRATEGY = '0x1111111111111111111111111111111111111111'
const AUCTION = '0x9999999999999999999999999999999999999999'
const CURRENCY = '0x2222222222222222222222222222222222222222'
const AUCTION_TOKEN = '0x3333333333333333333333333333333333333333'

const originalApiHost = process.env.API_HOST

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async (_ctx?: any) => ({ ok: true, ip: '127.0.0.1', auth: null })),
  readContract: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
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
    })),
  }
})

describe('v1 auction status handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.API_HOST = 'api.4626.fun'
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.readContract.mockImplementation(async ({ functionName, address }: { functionName: string; address?: string }) => {
      switch (functionName) {
        case 'getAuctionStatus':
          return [AUCTION, true, false, 123n, 456n]
        case 'currency':
          return CURRENCY
        case 'auctionToken':
          return AUCTION_TOKEN
        case 'decimals':
          return String(address || '').toLowerCase() === CURRENCY.toLowerCase() ? 6 : 18
        case 'symbol':
          return 'SHARE'
        default:
          return null
      }
    })
  })

  afterAll(() => {
    if (typeof originalApiHost === 'string') {
      process.env.API_HOST = originalApiHost
      return
    }
    delete process.env.API_HOST
  })

  it('registers static and dynamic status routes', async () => {
    const { getV1ApiHandler } = await import('../_handlers/_routes.v1.ts')

    await expect(getV1ApiHandler('auction/status')).resolves.toBeTypeOf('function')
    await expect(getV1ApiHandler(`auction/${CCA_STRATEGY}/status`)).resolves.toBeTypeOf('function')
  })

  it('returns canonical token image URL and same-origin fallback path', async () => {
    const mod = await import('../_handlers/v1/auction/_status.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { ccaStrategy: CCA_STRATEGY },
      headers: { host: 'app.4626.fun' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      ccaStrategy: CCA_STRATEGY.toLowerCase(),
      auction: AUCTION.toLowerCase(),
      auctionToken: AUCTION_TOKEN.toLowerCase(),
      auctionTokenSymbol: 'SHARE',
      auctionTokenDecimals: 18,
      currencyDecimals: 6,
      auctionTokenImagePath: `/api/v1/token/${AUCTION_TOKEN.toLowerCase()}/image?chain=8453&format=png`,
      auctionTokenImageUrl: `https://api.4626.fun/v1/token/${AUCTION_TOKEN.toLowerCase()}/image?chain=8453&format=png`,
    })
  })

  it('does not trust forwarded host headers when API_HOST is unset', async () => {
    delete process.env.API_HOST
    const mod = await import('../_handlers/v1/auction/_status.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { ccaStrategy: CCA_STRATEGY },
      headers: {
        host: 'attacker.invalid',
        'x-forwarded-host': 'attacker.invalid',
        'x-forwarded-proto': 'http',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.auctionTokenImagePath).toBe(`/api/v1/token/${AUCTION_TOKEN.toLowerCase()}/image?chain=8453&format=png`)
    expect(res.body?.data?.auctionTokenImageUrl).toBe(`/api/v1/token/${AUCTION_TOKEN.toLowerCase()}/image?chain=8453&format=png`)
  })
})
