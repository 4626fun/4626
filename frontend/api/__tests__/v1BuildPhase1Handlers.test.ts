import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData } from 'viem'

import auctionSubmitBidHandler from '../_handlers/v1/build/auction/_submitBid.ts'
import gaugeResetVotesHandler from '../_handlers/v1/build/gauge/_resetVotes.ts'
import gaugeVoteHandler from '../_handlers/v1/build/gauge/_vote.ts'
import veExtendHandler from '../_handlers/v1/build/ve4626/_extend.ts'
import veIncreaseHandler from '../_handlers/v1/build/ve4626/_increase.ts'
import veLockHandler from '../_handlers/v1/build/ve4626/_lock.ts'
import veUnlockHandler from '../_handlers/v1/build/ve4626/_unlock.ts'
import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 79, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  getApiContracts: vi.fn(() => ({
    vaultGaugeVoting: '0x1111111111111111111111111111111111111111',
    ve4626: '0x2222222222222222222222222222222222222222',
  })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
  readBoundedJsonObjectBody: mocks.readJsonBody,
  readJsonBody: mocks.readJsonBody,
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/contracts.js', () => ({
  getApiContracts: mocks.getApiContracts,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    buildAuctionSubmitBid: { windowMs: 60_000, maxRequests: 80 },
    buildGaugeVote: { windowMs: 60_000, maxRequests: 80 },
    buildVe4626Calldata: { windowMs: 60_000, maxRequests: 80 },
  },
}))

const AUCTION = '0x3333333333333333333333333333333333333333'
const OWNER = '0x4444444444444444444444444444444444444444'
const TOKEN = '0x5555555555555555555555555555555555555555'
const VALID_LOCK_DURATION_SEC = 7 * 24 * 60 * 60

const AUCTION_ABI = [
  {
    name: 'submitBid',
    type: 'function',
    inputs: [
      { name: 'maxPrice', type: 'uint256' },
      { name: 'amount', type: 'uint128' },
      { name: 'owner', type: 'address' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'bidId', type: 'uint256' }],
    stateMutability: 'payable',
  },
] as const

const GAUGE_VOTE_ABI = [
  {
    type: 'function',
    name: 'vote',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address[]' }, { type: 'uint256[]' }],
    outputs: [],
  },
] as const

const GAUGE_RESET_ABI = [
  {
    type: 'function',
    name: 'resetVotes',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const GAUGE_RESET_WITH_INDEX_ABI = [
  {
    type: 'function',
    name: 'resetVotes',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }],
    outputs: [],
  },
] as const

const VE_LOCK_ABI = [
  {
    type: 'function',
    name: 'lock',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const VE_EXTEND_ABI = [
  {
    type: 'function',
    name: 'extendLock',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const VE_INCREASE_ABI = [
  {
    type: 'function',
    name: 'increaseLock',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const VE_UNLOCK_ABI = [
  {
    type: 'function',
    name: 'unlock',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const VE_UNLOCK_WITH_INDEX_ABI = [
  {
    type: 'function',
    name: 'unlock',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

describe('v1 build phase 1 handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.readJsonBody.mockImplementation(async (req: any) => req.body ?? null)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 79, resetAt: Date.now() + 60_000 })
    mocks.getApiContracts.mockReturnValue({
      vaultGaugeVoting: '0x1111111111111111111111111111111111111111',
      ve4626: '0x2222222222222222222222222222222222222222',
    })
  })

  it('returns 429 when phase1 build rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({
      method: 'POST',
      body: {
        auction: AUCTION,
        owner: OWNER,
        maxPriceQ96: '1000000000000',
        amountWei: '12345',
      },
    })
    const res = createMockRes()
    await auctionSubmitBidHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
  })

  it('returns 429 for resetVotes and unlock when rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const resetReq = createMockReq({ method: 'POST', body: {} })
    const resetRes = createMockRes()
    await gaugeResetVotesHandler(resetReq, resetRes)
    expect(resetRes.statusCode).toBe(429)
    expect(resetRes.body?.error).toBe('Too many requests')

    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const unlockReq = createMockReq({ method: 'POST', body: {} })
    const unlockRes = createMockRes()
    await veUnlockHandler(unlockReq, unlockRes)
    expect(unlockRes.statusCode).toBe(429)
    expect(unlockRes.body?.error).toBe('Too many requests')
  })

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await auctionSubmitBidHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })

  it('passes through auth guard failure for all phase 1 handlers', async () => {
    mocks.guardAgentApiRequest.mockImplementation(async (...args: any[]) => {
      const [{ res } = {} as any] = args
      res.status(401).json({ success: false, error: 'Authentication required' })
      return { ok: false, ip: '127.0.0.1', auth: null }
    })

    const cases = [
      {
        handler: auctionSubmitBidHandler,
        body: { auction: AUCTION, owner: OWNER, maxPriceQ96: '1', amountWei: '1' },
      },
      {
        handler: gaugeVoteHandler,
        body: { vaults: ['0x6666666666666666666666666666666666666666'], weights: ['1'] },
      },
      { handler: gaugeResetVotesHandler, body: {} },
      { handler: veLockHandler, body: { token: TOKEN, amount: '1', durationSec: '1' } },
      { handler: veExtendHandler, body: { newEnd: '1' } },
      { handler: veIncreaseHandler, body: { amount: '1' } },
      { handler: veUnlockHandler, body: {} },
    ] as const

    for (const c of cases) {
      const req = createMockReq({ method: 'POST', body: c.body })
      const res = createMockRes()
      await c.handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(res.body?.success).toBe(false)
    }
  })

  it('builds auction submitBid calldata', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        auction: AUCTION,
        owner: OWNER,
        maxPriceQ96: '1000000000000',
        amountWei: '12345',
      },
    })
    const res = createMockRes()
    await auctionSubmitBidHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.to).toBe(AUCTION)
    expect(res.body?.data?.value).toBe('12345')
    expect(res.body?.data?.chainId).toBe(8453)
    const expectedData = encodeFunctionData({
      abi: AUCTION_ABI,
      functionName: 'submitBid',
      args: [1000000000000n, 12345n, OWNER, '0x'],
    })
    expect(res.body?.data?.data).toBe(expectedData)
  })

  it('changes auction calldata when key args are mutated', async () => {
    const baseReq = createMockReq({
      method: 'POST',
      body: {
        auction: AUCTION,
        owner: OWNER,
        maxPriceQ96: '1000000000000',
        amountWei: '12345',
      },
    })
    const baseRes = createMockRes()
    await auctionSubmitBidHandler(baseReq, baseRes)
    expect(baseRes.statusCode).toBe(200)

    const mutatedReq = createMockReq({
      method: 'POST',
      body: {
        auction: AUCTION,
        owner: OWNER,
        maxPriceQ96: '1000000000001',
        amountWei: '12345',
      },
    })
    const mutatedRes = createMockRes()
    await auctionSubmitBidHandler(mutatedReq, mutatedRes)
    expect(mutatedRes.statusCode).toBe(200)
    expect(mutatedRes.body?.data?.data).not.toBe(baseRes.body?.data?.data)
  })

  it('validates auction amount bounds', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        auction: AUCTION,
        owner: OWNER,
        maxPriceQ96: '1',
        amountWei: '0',
      },
    })
    const res = createMockRes()
    await auctionSubmitBidHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('amountWei')
  })

  it('builds gauge vote calldata', async () => {
    const vault = '0x6666666666666666666666666666666666666666'
    const req = createMockReq({
      method: 'POST',
      body: {
        vaults: [vault],
        weights: ['1000'],
      },
    })
    const res = createMockRes()
    await gaugeVoteHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.to).toBe('0x1111111111111111111111111111111111111111')
    expect(res.body?.data?.value).toBe('0')
    expect(res.body?.data?.chainId).toBe(8453)
    const expectedData = encodeFunctionData({
      abi: GAUGE_VOTE_ABI,
      functionName: 'vote',
      args: [[vault], [1000n]],
    })
    expect(res.body?.data?.data).toBe(expectedData)
  })

  it('changes gauge vote calldata when weights are mutated', async () => {
    const vault = '0x6666666666666666666666666666666666666666'

    const baseReq = createMockReq({
      method: 'POST',
      body: {
        vaults: [vault],
        weights: ['1000'],
      },
    })
    const baseRes = createMockRes()
    await gaugeVoteHandler(baseReq, baseRes)
    expect(baseRes.statusCode).toBe(200)

    const mutatedReq = createMockReq({
      method: 'POST',
      body: {
        vaults: [vault],
        weights: ['1001'],
      },
    })
    const mutatedRes = createMockRes()
    await gaugeVoteHandler(mutatedReq, mutatedRes)
    expect(mutatedRes.statusCode).toBe(200)
    expect(mutatedRes.body?.data?.data).not.toBe(baseRes.body?.data?.data)
  })

  it('validates gauge vote input lengths', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        vaults: ['0x6666666666666666666666666666666666666666'],
        weights: ['1', '2'],
      },
    })
    const res = createMockRes()
    await gaugeVoteHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('length mismatch')
  })

  it('builds gauge resetVotes calldata', async () => {
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await gaugeResetVotesHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.to).toBe('0x1111111111111111111111111111111111111111')
    const expectedData = encodeFunctionData({
      abi: GAUGE_RESET_ABI,
      functionName: 'resetVotes',
      args: [],
    })
    expect(res.body?.data?.data).toBe(expectedData)
    const wrongSignature = encodeFunctionData({
      abi: GAUGE_RESET_WITH_INDEX_ABI,
      functionName: 'resetVotes',
      args: [1n],
    })
    expect(res.body?.data?.data).not.toBe(wrongSignature)
  })

  it('returns 503 when gauge contract config is missing', async () => {
    mocks.getApiContracts.mockReturnValueOnce({
      vaultGaugeVoting: '',
      ve4626: '0x2222222222222222222222222222222222222222',
    })
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await gaugeResetVotesHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(String(res.body?.error ?? '')).toContain('VaultGaugeVoting not configured')
  })

  it('builds ve lock calldata', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { token: TOKEN, amount: '100', durationSec: String(VALID_LOCK_DURATION_SEC) },
    })
    const res = createMockRes()
    await veLockHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.to).toBe('0x2222222222222222222222222222222222222222')
    const expectedData = encodeFunctionData({
      abi: VE_LOCK_ABI,
      functionName: 'lock',
      args: [TOKEN, 100n, BigInt(VALID_LOCK_DURATION_SEC)],
    })
    expect(res.body?.data?.data).toBe(expectedData)
  })

  it('changes ve lock calldata when duration is mutated', async () => {
    const baseReq = createMockReq({
      method: 'POST',
      body: { token: TOKEN, amount: '100', durationSec: String(VALID_LOCK_DURATION_SEC) },
    })
    const baseRes = createMockRes()
    await veLockHandler(baseReq, baseRes)
    expect(baseRes.statusCode).toBe(200)

    const mutatedReq = createMockReq({
      method: 'POST',
      body: { token: TOKEN, amount: '100', durationSec: String(VALID_LOCK_DURATION_SEC + 1) },
    })
    const mutatedRes = createMockRes()
    await veLockHandler(mutatedReq, mutatedRes)
    expect(mutatedRes.statusCode).toBe(200)
    expect(mutatedRes.body?.data?.data).not.toBe(baseRes.body?.data?.data)
  })

  it('validates ve lock token input', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { token: 'not-an-address', amount: '100', durationSec: String(VALID_LOCK_DURATION_SEC) },
    })
    const res = createMockRes()
    await veLockHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('token is required')
  })

  it('validates ve lock duration bounds', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { token: TOKEN, amount: '100', durationSec: String(VALID_LOCK_DURATION_SEC - 1) },
    })
    const res = createMockRes()
    await veLockHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('durationSec must be between')
  })

  it('builds ve extend calldata', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const newEnd = BigInt(nowSec + 14 * 24 * 60 * 60)
    const extendReq = createMockReq({ method: 'POST', body: { newEnd: newEnd.toString() } })
    const extendRes = createMockRes()
    await veExtendHandler(extendReq, extendRes)
    expect(extendRes.statusCode).toBe(200)
    expect(extendRes.body?.success).toBe(true)
    const expectedExtendData = encodeFunctionData({
      abi: VE_EXTEND_ABI,
      functionName: 'extendLock',
      args: [newEnd],
    })
    expect(extendRes.body?.data?.data).toBe(expectedExtendData)
  })

  it('builds ve increase calldata', async () => {
    const increaseReq = createMockReq({ method: 'POST', body: { amount: '250' } })
    const increaseRes = createMockRes()
    await veIncreaseHandler(increaseReq, increaseRes)
    expect(increaseRes.statusCode).toBe(200)
    expect(increaseRes.body?.success).toBe(true)
    const expectedIncreaseData = encodeFunctionData({
      abi: VE_INCREASE_ABI,
      functionName: 'increaseLock',
      args: [250n],
    })
    expect(increaseRes.body?.data?.data).toBe(expectedIncreaseData)
  })

  it('builds ve unlock calldata', async () => {
    const unlockReq = createMockReq({ method: 'POST', body: {} })
    const unlockRes = createMockRes()
    await veUnlockHandler(unlockReq, unlockRes)
    expect(unlockRes.statusCode).toBe(200)
    expect(unlockRes.body?.success).toBe(true)
    const expectedUnlockData = encodeFunctionData({
      abi: VE_UNLOCK_ABI,
      functionName: 'unlock',
      args: [],
    })
    expect(unlockRes.body?.data?.data).toBe(expectedUnlockData)
    const wrongUnlockSignature = encodeFunctionData({
      abi: VE_UNLOCK_WITH_INDEX_ABI,
      functionName: 'unlock',
      args: [1n],
    })
    expect(unlockRes.body?.data?.data).not.toBe(wrongUnlockSignature)
  })

  it('changes ve extend calldata when newEnd is mutated', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const baseEnd = nowSec + 14 * 24 * 60 * 60
    const mutatedEnd = nowSec + 15 * 24 * 60 * 60

    const baseReq = createMockReq({ method: 'POST', body: { newEnd: String(baseEnd) } })
    const baseRes = createMockRes()
    await veExtendHandler(baseReq, baseRes)
    expect(baseRes.statusCode).toBe(200)

    const mutatedReq = createMockReq({ method: 'POST', body: { newEnd: String(mutatedEnd) } })
    const mutatedRes = createMockRes()
    await veExtendHandler(mutatedReq, mutatedRes)
    expect(mutatedRes.statusCode).toBe(200)
    expect(mutatedRes.body?.data?.data).not.toBe(baseRes.body?.data?.data)
  })

  it('changes ve increase calldata when amount is mutated', async () => {
    const baseReq = createMockReq({ method: 'POST', body: { amount: '250' } })
    const baseRes = createMockRes()
    await veIncreaseHandler(baseReq, baseRes)
    expect(baseRes.statusCode).toBe(200)

    const mutatedReq = createMockReq({ method: 'POST', body: { amount: '251' } })
    const mutatedRes = createMockRes()
    await veIncreaseHandler(mutatedReq, mutatedRes)
    expect(mutatedRes.statusCode).toBe(200)
    expect(mutatedRes.body?.data?.data).not.toBe(baseRes.body?.data?.data)
  })

  it('validates ve extend newEnd window', async () => {
    const nowSec = Math.floor(Date.now() / 1000)

    const pastReq = createMockReq({ method: 'POST', body: { newEnd: String(nowSec - 1) } })
    const pastRes = createMockRes()
    await veExtendHandler(pastReq, pastRes)
    expect(pastRes.statusCode).toBe(400)
    expect(String(pastRes.body?.error ?? '')).toContain('future unix timestamp')

    const farFutureReq = createMockReq({ method: 'POST', body: { newEnd: String(nowSec + 5 * 365 * 24 * 60 * 60) } })
    const farFutureRes = createMockRes()
    await veExtendHandler(farFutureReq, farFutureRes)
    expect(farFutureRes.statusCode).toBe(400)
    expect(String(farFutureRes.body?.error ?? '')).toContain('cannot exceed now')
  })

  it('validates ve extend/increase numeric inputs', async () => {
    const extendReq = createMockReq({ method: 'POST', body: { newEnd: '0' } })
    const extendRes = createMockRes()
    await veExtendHandler(extendReq, extendRes)
    expect(extendRes.statusCode).toBe(400)

    const increaseReq = createMockReq({ method: 'POST', body: { amount: '0' } })
    const increaseRes = createMockRes()
    await veIncreaseHandler(increaseReq, increaseRes)
    expect(increaseRes.statusCode).toBe(400)
  })
})
