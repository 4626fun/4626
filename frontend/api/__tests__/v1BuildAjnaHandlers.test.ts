import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData } from 'viem'

import addCollateralHandler from '../_handlers/v1/build/ajna/_addCollateral.ts'
import borrowHandler from '../_handlers/v1/build/ajna/_borrow.ts'
import moveToBucketHandler from '../_handlers/v1/build/ajna/_moveToBucket.ts'
import removeCollateralHandler from '../_handlers/v1/build/ajna/_removeCollateral.ts'
import repayHandler from '../_handlers/v1/build/ajna/_repay.ts'
import setBucketIndexHandler from '../_handlers/v1/build/ajna/_setBucketIndex.ts'
import setIdleBufferBpsHandler from '../_handlers/v1/build/ajna/_setIdleBufferBps.ts'
import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
  readJsonBody: mocks.readJsonBody,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

const POOL = '0x1111111111111111111111111111111111111111'
const BORROWER = '0x2222222222222222222222222222222222222222'
const RECEIVER = '0x3333333333333333333333333333333333333333'
const STRATEGY = '0x4444444444444444444444444444444444444444'

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

const AJNA_STRATEGY_OWNER_ABI = [
  { type: 'function', name: 'setBucketIndex', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'moveToBucket', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setIdleBufferBps', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
] as const

describe('v1 build Ajna handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.readJsonBody.mockImplementation(async (req: any) => req.body ?? null)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
  })

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await borrowHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })

  it('passes through auth guard failure for all Ajna handlers', async () => {
    mocks.guardAgentApiRequest.mockImplementation(async ({ res }: any) => {
      res.status(401).json({ success: false, error: 'Authentication required' })
      return { ok: false, ip: '127.0.0.1' }
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
      { handler: setBucketIndexHandler, body: { strategy: STRATEGY, newBucketIndex: '100' } },
      { handler: moveToBucketHandler, body: { strategy: STRATEGY, newBucketIndex: '100', maxAmountLp: '1' } },
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

  it('builds setBucketIndex calldata and enforces bucket bounds', async () => {
    const goodReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, newBucketIndex: '7388' },
    })
    const goodRes = createMockRes()
    await setBucketIndexHandler(goodReq, goodRes)
    expect(goodRes.statusCode).toBe(200)
    const expected = encodeFunctionData({
      abi: AJNA_STRATEGY_OWNER_ABI,
      functionName: 'setBucketIndex',
      args: [7388n],
    })
    expect(goodRes.body?.data?.data).toBe(expected)

    const badReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, newBucketIndex: '7389' },
    })
    const badRes = createMockRes()
    await setBucketIndexHandler(badReq, badRes)
    expect(badRes.statusCode).toBe(400)
    expect(String(badRes.body?.error ?? '')).toContain('newBucketIndex must be between')
  })

  it('builds moveToBucket calldata and validates maxAmountLp', async () => {
    const goodReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, newBucketIndex: '123', maxAmountLp: '456' },
    })
    const goodRes = createMockRes()
    await moveToBucketHandler(goodReq, goodRes)
    expect(goodRes.statusCode).toBe(200)
    const expected = encodeFunctionData({
      abi: AJNA_STRATEGY_OWNER_ABI,
      functionName: 'moveToBucket',
      args: [123n, 456n],
    })
    expect(goodRes.body?.data?.data).toBe(expected)

    const badReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, newBucketIndex: '123', maxAmountLp: '0' },
    })
    const badRes = createMockRes()
    await moveToBucketHandler(badReq, badRes)
    expect(badRes.statusCode).toBe(400)
    expect(String(badRes.body?.error ?? '')).toContain('maxAmountLp must be > 0')
  })

  it('builds setIdleBufferBps calldata and validates bps range', async () => {
    const goodReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, idleBufferBps: '10000' },
    })
    const goodRes = createMockRes()
    await setIdleBufferBpsHandler(goodReq, goodRes)
    expect(goodRes.statusCode).toBe(200)
    const expected = encodeFunctionData({
      abi: AJNA_STRATEGY_OWNER_ABI,
      functionName: 'setIdleBufferBps',
      args: [10000n],
    })
    expect(goodRes.body?.data?.data).toBe(expected)

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
