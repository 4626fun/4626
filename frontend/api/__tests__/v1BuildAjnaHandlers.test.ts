import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData } from 'viem'

import addCollateralHandler from '../_handlers/v1/build/ajna/_addCollateral.ts'
import borrowHandler from '../_handlers/v1/build/ajna/_borrow.ts'
import removeCollateralHandler from '../_handlers/v1/build/ajna/_removeCollateral.ts'
import repayHandler from '../_handlers/v1/build/ajna/_repay.ts'
import setMinBucketIndexHandler from '../_handlers/v1/build/ajna/_setMinBucketIndex.ts'
import setIdleBufferBpsHandler from '../_handlers/v1/build/ajna/_setIdleBufferBps.ts'
import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  guardAgentApiRequest: vi.fn(async (_ctx?: any) => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
  readBoundedJsonObjectBody: mocks.readJsonBody,
  readJsonBody: mocks.readJsonBody,
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    buildAjnaCalldata: { windowMs: 60_000, maxRequests: 120 },
  },
}))

const POOL = '0x1111111111111111111111111111111111111111'
const BORROWER = '0x2222222222222222222222222222222222222222'
const RECEIVER = '0x3333333333333333333333333333333333333333'
const STRATEGY = '0x4444444444444444444444444444444444444444'
const AUTH = '0x5555555555555555555555555555555555555555'

const AJNA_POOL_ABI = [
  {
    type: 'function',
    name: 'drawDebt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'borrowerAddress', type: 'address' },
      { name: 'amountToBorrow', type: 'uint256' },
      { name: 'limitIndex', type: 'uint256' },
      { name: 'collateralToPledge', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repayDebt',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'borrowerAddress', type: 'address' },
      { name: 'maxQuoteTokenAmountToRepay', type: 'uint256' },
      { name: 'collateralAmountToPull', type: 'uint256' },
      { name: 'collateralReceiver', type: 'address' },
      { name: 'limitIndex', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const AJNA_AUTH_ADMIN_ABI = [
  { type: 'function', name: 'setMinBucketIndex', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
] as const

const AJNA_ADAPTER_OWNER_ABI = [
  { type: 'function', name: 'setIdleBufferBps', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
] as const

describe('v1 build Ajna handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.readJsonBody.mockImplementation(async (req: any) => req.body ?? null)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
  })

  it('returns 429 when Ajna build rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({
      method: 'POST',
      body: { pool: POOL, borrower: BORROWER, amountToBorrow: '1', limitIndex: '100' },
    })
    const res = createMockRes()
    await borrowHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
  })

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await borrowHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })

  it('passes through auth guard failure for all Ajna handlers', async () => {
    mocks.guardAgentApiRequest.mockImplementation(async ({ res }: any = {}) => {
      res?.status(401).json({ success: false, error: 'Authentication required' })
      return { ok: false, ip: '127.0.0.1', auth: null }
    })

    const cases = [
      {
        handler: borrowHandler,
        body: { pool: POOL, borrower: BORROWER, amountToBorrow: '1', limitIndex: '100' },
      },
      {
        handler: repayHandler,
        body: {
          pool: POOL,
          borrower: BORROWER,
          maxQuoteTokenAmountToRepay: '1',
          collateralReceiver: RECEIVER,
          limitIndex: '100',
        },
      },
      { handler: addCollateralHandler, body: { pool: POOL, borrower: BORROWER, collateralToPledge: '1', limitIndex: '100' } },
      {
        handler: removeCollateralHandler,
        body: { pool: POOL, borrower: BORROWER, collateralAmountToPull: '1', collateralReceiver: RECEIVER, limitIndex: '100' },
      },
      { handler: setMinBucketIndexHandler, body: { auth: AUTH, minBucketIndex: '100' } },
      { handler: setIdleBufferBpsHandler, body: { strategy: STRATEGY, idleBufferBps: '1000' } },
    ] as const

    for (const c of cases) {
      const req = createMockReq({ method: 'POST', body: c.body })
      const res = createMockRes()
      await c.handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(res.body?.success).toBe(false)
    }
  })

  it('builds borrow calldata and validates basic bounds', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { pool: POOL, borrower: BORROWER, amountToBorrow: '123', limitIndex: '500' },
    })
    const res = createMockRes()
    await borrowHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.to).toBe(POOL)
    const expected = encodeFunctionData({
      abi: AJNA_POOL_ABI,
      functionName: 'drawDebt',
      args: [BORROWER, 123n, 500n, 0n],
    })
    expect(res.body?.data?.data).toBe(expected)
  })

  it('rejects invalid borrow inputs', async () => {
    const badAmountReq = createMockReq({
      method: 'POST',
      body: { pool: POOL, borrower: BORROWER, amountToBorrow: '0', limitIndex: '500' },
    })
    const badAmountRes = createMockRes()
    await borrowHandler(badAmountReq, badAmountRes)
    expect(badAmountRes.statusCode).toBe(400)
    expect(String(badAmountRes.body?.error ?? '')).toContain('amountToBorrow must be > 0')

    const badIndexReq = createMockReq({
      method: 'POST',
      body: { pool: POOL, borrower: BORROWER, amountToBorrow: '1', limitIndex: '0' },
    })
    const badIndexRes = createMockRes()
    await borrowHandler(badIndexReq, badIndexRes)
    expect(badIndexRes.statusCode).toBe(400)
    expect(String(badIndexRes.body?.error ?? '')).toContain('limitIndex must be between')
  })

  it('builds repay calldata', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        pool: POOL,
        borrower: BORROWER,
        maxQuoteTokenAmountToRepay: '1000',
        collateralAmountToPull: '20',
        collateralReceiver: RECEIVER,
        limitIndex: '400',
      },
    })
    const res = createMockRes()
    await repayHandler(req, res)
    expect(res.statusCode).toBe(200)
    const expected = encodeFunctionData({
      abi: AJNA_POOL_ABI,
      functionName: 'repayDebt',
      args: [BORROWER, 1000n, 20n, RECEIVER, 400n],
    })
    expect(res.body?.data?.data).toBe(expected)
  })

  it('builds addCollateral and removeCollateral calldata', async () => {
    const addReq = createMockReq({
      method: 'POST',
      body: { pool: POOL, borrower: BORROWER, collateralToPledge: '55', limitIndex: '777' },
    })
    const addRes = createMockRes()
    await addCollateralHandler(addReq, addRes)
    expect(addRes.statusCode).toBe(200)
    const expectedAdd = encodeFunctionData({
      abi: AJNA_POOL_ABI,
      functionName: 'drawDebt',
      args: [BORROWER, 0n, 777n, 55n],
    })
    expect(addRes.body?.data?.data).toBe(expectedAdd)

    const removeReq = createMockReq({
      method: 'POST',
      body: {
        pool: POOL,
        borrower: BORROWER,
        collateralAmountToPull: '10',
        collateralReceiver: RECEIVER,
        limitIndex: '777',
      },
    })
    const removeRes = createMockRes()
    await removeCollateralHandler(removeReq, removeRes)
    expect(removeRes.statusCode).toBe(200)
    const expectedRemove = encodeFunctionData({
      abi: AJNA_POOL_ABI,
      functionName: 'repayDebt',
      args: [BORROWER, 0n, 10n, RECEIVER, 777n],
    })
    expect(removeRes.body?.data?.data).toBe(expectedRemove)
  })

  it('builds setMinBucketIndex calldata for nested Ajna auth, allows 0 sentinel, rejects decimals, and rejects 7389', async () => {
    const goodReq = createMockReq({
      method: 'POST',
      body: { auth: AUTH, minBucketIndex: '0' },
    })
    const goodRes = createMockRes()
    await setMinBucketIndexHandler(goodReq, goodRes)
    expect(goodRes.statusCode).toBe(200)
    const expected = encodeFunctionData({
      abi: AJNA_AUTH_ADMIN_ABI,
      functionName: 'setMinBucketIndex',
      args: [0n],
    })
    expect(goodRes.body?.data?.to).toBe(AUTH)
    expect(goodRes.body?.data?.data).toBe(expected)

    const badReq = createMockReq({
      method: 'POST',
      body: { auth: AUTH, minBucketIndex: '7389' },
    })
    const badRes = createMockRes()
    await setMinBucketIndexHandler(badReq, badRes)
    expect(badRes.statusCode).toBe(400)
    expect(String(badRes.body?.error ?? '')).toContain('minBucketIndex must be between 0 and 7388')

    const decimalReq = createMockReq({
      method: 'POST',
      body: { auth: AUTH, minBucketIndex: 0.9 },
    })
    const decimalRes = createMockRes()
    await setMinBucketIndexHandler(decimalReq, decimalRes)
    expect(decimalRes.statusCode).toBe(400)
    expect(String(decimalRes.body?.error ?? '')).toContain('Invalid minBucketIndex')
  })

  it('builds setIdleBufferBps calldata for the nested Ajna adapter and validates bps range', async () => {
    const goodReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, idleBufferBps: '10000' },
    })
    const goodRes = createMockRes()
    await setIdleBufferBpsHandler(goodReq, goodRes)
    expect(goodRes.statusCode).toBe(200)
    const expected = encodeFunctionData({
      abi: AJNA_ADAPTER_OWNER_ABI,
      functionName: 'setIdleBufferBps',
      args: [10000n],
    })
    expect(goodRes.body?.data?.to).toBe(STRATEGY)
    expect(goodRes.body?.data?.data).toBe(expected)
    expect(
      Array.isArray(goodRes.body?.data?.warnings) &&
        goodRes.body.data.warnings.some((warning: string) => /legacy direct ajnastrategy/i.test(warning)),
    ).toBe(false)

    const badReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, idleBufferBps: '10001' },
    })
    const badRes = createMockRes()
    await setIdleBufferBpsHandler(badReq, badRes)
    expect(badRes.statusCode).toBe(400)
    expect(String(badRes.body?.error ?? '')).toContain('idleBufferBps must be between 0 and 10000')
  })
})
