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
        case 'getLifecycleStatus':
          return {
            phase: 1,
            auction: AUCTION,
            isGraduated: false,
            auctionWindowOpen: true,
            claimOpen: false,
            currencySwept: false,
            unsoldSwept: false,
            migrated: false,
            failedFinalized: false,
            startBlock: 1000n,
            endBlock: 2000n,
            claimBlock: 2100n,
            migrationBlock: 2001n,
            sweepBlock: 2500n,
            lpReserveAmount: 789n,
            clearingPrice: 123n,
            currencyRaised: 456n,
          }
        case 'getBackingTelemetry':
          return {
            vault: '0x4444444444444444444444444444444444444444',
            launchTotalAssets: 1_000n,
            launchTotalSupply: 10_000n,
            currentTotalAssets: 1_250n,
            currentTotalSupply: 10_000n,
            assetsDelta: 250n,
            supplyDelta: 0n,
          }
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
      headers: { host: 'v1.4626.fun' },
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
      auctionLifecycleDegraded: false,
      auctionTokenDecimals: 18,
      currencyDecimals: 6,
      lifecyclePhase: 1,
      lifecycleAuctionWindowOpen: true,
      lifecycleClaimOpen: false,
      lifecycleMigrated: false,
      lifecycleFailedFinalized: false,
      lifecycleLpReserveAmount: '789',
      assetsDelta: '250',
      supplyDelta: '0',
      auctionTokenImagePath: `/api/v1/token/${AUCTION_TOKEN.toLowerCase()}/image?chain=8453&format=png`,
      auctionTokenImageUrl: `https://api.4626.fun/v1/token/${AUCTION_TOKEN.toLowerCase()}/image?chain=8453&format=png`,
    })
  })

  it('maps ws-prefixed on-chain auction token symbols to ■-prefixed share display', async () => {
    mocks.readContract.mockImplementation(async ({ functionName, address }: { functionName: string; address?: string }) => {
      switch (functionName) {
        case 'getAuctionStatus':
          return [AUCTION, true, false, 123n, 456n]
        case 'getLifecycleStatus':
          return {
            phase: 1,
            auction: AUCTION,
            isGraduated: false,
            auctionWindowOpen: true,
            claimOpen: false,
            currencySwept: false,
            unsoldSwept: false,
            migrated: false,
            failedFinalized: false,
            startBlock: 1000n,
            endBlock: 2000n,
            claimBlock: 2100n,
            migrationBlock: 2001n,
            sweepBlock: 2500n,
            lpReserveAmount: 789n,
            clearingPrice: 123n,
            currencyRaised: 456n,
          }
        case 'getBackingTelemetry':
          return {
            vault: '0x4444444444444444444444444444444444444444',
            launchTotalAssets: 1_000n,
            launchTotalSupply: 10_000n,
            currentTotalAssets: 1_250n,
            currentTotalSupply: 10_000n,
            assetsDelta: 250n,
            supplyDelta: 0n,
          }
        case 'currency':
          return CURRENCY
        case 'auctionToken':
          return AUCTION_TOKEN
        case 'decimals':
          return String(address || '').toLowerCase() === CURRENCY.toLowerCase() ? 6 : 18
        case 'symbol':
          return String(address || '').toLowerCase() === AUCTION_TOKEN.toLowerCase() ? 'wsAKITA' : 'SHARE'
        default:
          return null
      }
    })

    const mod = await import('../_handlers/v1/auction/_status.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { ccaStrategy: CCA_STRATEGY },
      headers: { host: 'v1.4626.fun' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.auctionTokenSymbol).toBe('\u25A0AKITA')
  })

  it('marks auctionLifecycleDegraded when no auction contract is bound', async () => {
    mocks.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'getAuctionStatus':
          return ['0x0000000000000000000000000000000000000000', false, false, 0n, 0n]
        case 'getLifecycleStatus':
          return {
            phase: 0,
            auction: '0x0000000000000000000000000000000000000000',
            isGraduated: false,
            auctionWindowOpen: false,
            claimOpen: false,
            currencySwept: false,
            unsoldSwept: false,
            migrated: false,
            failedFinalized: false,
            startBlock: 0n,
            endBlock: 0n,
            claimBlock: 0n,
            migrationBlock: 0n,
            sweepBlock: 0n,
            lpReserveAmount: 0n,
            clearingPrice: 0n,
            currencyRaised: 0n,
          }
        case 'getBackingTelemetry':
          return {
            vault: '0x0000000000000000000000000000000000000000',
            launchTotalAssets: 0n,
            launchTotalSupply: 0n,
            currentTotalAssets: 0n,
            currentTotalSupply: 0n,
            assetsDelta: 0n,
            supplyDelta: 0n,
          }
        case 'currency':
          return CURRENCY
        case 'auctionToken':
          return AUCTION_TOKEN
        case 'decimals':
          return 18
        case 'symbol':
          return 'wsAKITA'
        default:
          return null
      }
    })

    const mod = await import('../_handlers/v1/auction/_status.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: { ccaStrategy: CCA_STRATEGY },
      headers: { host: 'v1.4626.fun' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.auction).toBeNull()
    expect(res.body?.data?.auctionLifecycleDegraded).toBe(true)
    expect(res.body?.data?.auctionTokenSymbol).toBe('\u25A0AKITA')
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
