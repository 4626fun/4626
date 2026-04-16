import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

const guardMock = vi.fn()
const issueAmoeNonceMock = vi.fn()
const buildAmoeEntryMessageMock = vi.fn()
const verifyAmoeEntryProofMock = vi.fn()
const createAmoeAttestationMock = vi.fn()
const getAmoeCreditSnapshotMock = vi.fn()
const consumeAmoeCreditsForEntryMock = vi.fn()
const claimDailyTwitterCheckinMock = vi.fn()
const resolveAuthorizedWalletProfileMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getClientIpMock = vi.fn()
const rateLimitKeyMock = vi.fn()

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: guardMock,
}))

vi.mock('../../server/_lib/onchain/contracts.js', () => ({
  getApiContracts: () => ({ lotteryManager: '0x77705A2f173dd52F28300447506Dc35086c34626' }),
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    lotteryRead: { windowMs: 60_000, maxRequests: 120 },
    lotteryWrite: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/_lib/wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readBoundedJsonObjectBody: vi.fn(async (req: any) => req.body ?? null),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
}))

vi.mock('../../server/_lib/lottery/lotteryAmoe.js', () => ({
  AMOE_CREDITS_PER_ENTRY: 100,
  issueAmoeNonce: issueAmoeNonceMock,
  buildAmoeEntryMessage: buildAmoeEntryMessageMock,
  verifyAmoeEntryProof: verifyAmoeEntryProofMock,
  createAmoeAttestation: createAmoeAttestationMock,
  getAmoeCreditSnapshot: getAmoeCreditSnapshotMock,
  consumeAmoeCreditsForEntry: consumeAmoeCreditsForEntryMock,
  claimDailyTwitterCheckin: claimDailyTwitterCheckinMock,
}))

describe('AMOE lottery routes', () => {
  it('registers AMOE nonce, credits, submit, and checkin routes', async () => {
    const nonceHandler = await getV1ApiHandler('lottery/amoe/nonce')
    const creditsHandler = await getV1ApiHandler('lottery/amoe/credits')
    const submitHandler = await getV1ApiHandler('lottery/amoe/submit')
    const checkinHandler = await getV1ApiHandler('lottery/amoe/twitter-checkin')
    expect(typeof nonceHandler).toBe('function')
    expect(typeof creditsHandler).toBe('function')
    expect(typeof submitHandler).toBe('function')
    expect(typeof checkinHandler).toBe('function')
  })
})

describe('AMOE nonce handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    getClientIpMock.mockReturnValue('127.0.0.1')
    rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
    issueAmoeNonceMock.mockResolvedValue({
      nonce: '0x1111111111111111111111111111111111111111111111111111111111111111',
      issuedAt: '2026-03-01T00:00:00.000Z',
      expiresAt: '2026-03-01T00:10:00.000Z',
    })
    getAmoeCreditSnapshotMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      credits: 55,
      creditsPerEntry: 100,
      entriesAvailable: 0,
      nextEntryAtCredits: 100,
    })
    buildAmoeEntryMessageMock.mockReturnValue('amoe-message')
  })

  it('rejects missing wallet/creatorCoin query params', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeNonce')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns 429 when nonce endpoint rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeNonce')
    const req = createMockReq({
      method: 'GET',
      query: {
        wallet: '0x000000000000000000000000000000000000cAFe',
        creatorCoin: '0x0000000000000000000000000000000000001001',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns nonce payload for valid query params', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeNonce')
    const req = createMockReq({
      method: 'GET',
      query: {
        wallet: '0x000000000000000000000000000000000000cAFe',
        creatorCoin: '0x0000000000000000000000000000000000001001',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.message).toBe('amoe-message')
    expect(res.body?.data?.credits).toBe(55)
    expect(res.body?.data?.creditsPerEntry).toBe(100)
    expect(res.body?.data?.entriesAvailable).toBe(0)
    expect(issueAmoeNonceMock).toHaveBeenCalledTimes(1)
    expect(getAmoeCreditSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('canonicalizes an authenticated active owner wallet to the canonical CSW', async () => {
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x0000000000000000000000000000000000000Aa1' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: '0x000000000000000000000000000000000000cafe',
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeNonce')
    const req = createMockReq({
      method: 'GET',
      query: {
        wallet: '0x0000000000000000000000000000000000000Aa1',
        creatorCoin: '0x0000000000000000000000000000000000001001',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(issueAmoeNonceMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
      creatorCoin: '0x0000000000000000000000000000000000001001',
    })
    expect(getAmoeCreditSnapshotMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
    })
    expect(buildAmoeEntryMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet: '0x000000000000000000000000000000000000cafe',
      }),
    )
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.wallet).toBe('0x000000000000000000000000000000000000cafe')
  })

  it('rejects wallet queries outside the authenticated canonical identity', async () => {
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x0000000000000000000000000000000000000Aa1' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: '0x000000000000000000000000000000000000cafe',
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeNonce')
    const req = createMockReq({
      method: 'GET',
      query: {
        wallet: '0x0000000000000000000000000000000000000Bb2',
        creatorCoin: '0x0000000000000000000000000000000000001001',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(issueAmoeNonceMock).not.toHaveBeenCalled()
    expect(getAmoeCreditSnapshotMock).not.toHaveBeenCalled()
  })
})

describe('AMOE credits handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
    getAmoeCreditSnapshotMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      credits: 77,
      creditsPerEntry: 100,
      entriesAvailable: 0,
      nextEntryAtCredits: 100,
    })
  })

  it('rejects missing wallet query param', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeCredits')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('returns credit snapshot for wallet', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeCredits')
    const req = createMockReq({
      method: 'GET',
      query: { wallet: '0x000000000000000000000000000000000000cAFe' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.credits).toBe(77)
    expect(getAmoeCreditSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('canonicalizes credits lookups for an authenticated active owner wallet', async () => {
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x0000000000000000000000000000000000000Aa1' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: '0x000000000000000000000000000000000000cafe',
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeCredits')
    const req = createMockReq({
      method: 'GET',
      query: { wallet: '0x0000000000000000000000000000000000000Aa1' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(getAmoeCreditSnapshotMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects credit lookups outside the authenticated canonical identity', async () => {
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x0000000000000000000000000000000000000Aa1' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: '0x000000000000000000000000000000000000cafe',
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeCredits')
    const req = createMockReq({
      method: 'GET',
      query: { wallet: '0x0000000000000000000000000000000000000Bb2' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(getAmoeCreditSnapshotMock).not.toHaveBeenCalled()
  })
})

describe('AMOE submit handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    verifyAmoeEntryProofMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      creatorCoin: '0x0000000000000000000000000000000000001001',
      nonce: '0x1111111111111111111111111111111111111111111111111111111111111111',
      expiresAt: '2026-03-01T00:10:00.000Z',
    })
    createAmoeAttestationMock.mockResolvedValue({
      buyer: '0x000000000000000000000000000000000000cafe',
      creatorCoin: '0x0000000000000000000000000000000000001001',
      nonce: '0x1111111111111111111111111111111111111111111111111111111111111111',
      deadline: 1772333400,
      signature: '0xabcdef',
      callData: '0xdeadbeef',
      to: '0x77705A2f173dd52F28300447506Dc35086c34626',
    })
    consumeAmoeCreditsForEntryMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      consumed: 100,
      creditsRemaining: 23,
      entriesAvailable: 0,
      creditsPerEntry: 100,
    })
  })

  it('rejects unsupported methods', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns attested AMOE submit payload', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: '0x0000000000000000000000000000000000001001',
        message: 'amoe-message',
        signature: '0x1234',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.callData).toBe('0xdeadbeef')
    expect(verifyAmoeEntryProofMock).toHaveBeenCalledTimes(1)
    expect(consumeAmoeCreditsForEntryMock).toHaveBeenCalledTimes(1)
    expect(createAmoeAttestationMock).toHaveBeenCalledTimes(1)
  })

  it('returns 429 when submit endpoint rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: '0x0000000000000000000000000000000000001001',
        message: 'amoe-message',
        signature: '0x1234',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns 402 when credits are insufficient', async () => {
    consumeAmoeCreditsForEntryMock.mockRejectedValue(new Error('insufficient_amoe_credits'))

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: '0x0000000000000000000000000000000000001001',
        message: 'amoe-message',
        signature: '0x1234',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(402)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toMatch(/insufficient/i)
  })
})

describe('AMOE daily Twitter checkin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x000000000000000000000000000000000000cafe' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
    claimDailyTwitterCheckinMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      awarded: true,
      awardedCredits: 1,
      credits: 101,
      creditsPerEntry: 100,
      entriesAvailable: 1,
    })
  })

  it('rejects unsupported methods', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeTwitterCheckin')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns daily checkin credit grant response', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeTwitterCheckin')
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.awardedCredits).toBe(1)
    expect(res.body?.data?.creditsPerEntry).toBe(100)
    expect(claimDailyTwitterCheckinMock).toHaveBeenCalledTimes(1)
  })

  it('claims credits for the canonical CSW when the session principal is the active owner wallet', async () => {
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x0000000000000000000000000000000000000Aa1' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 42,
      canonicalSmartWalletAddress: '0x000000000000000000000000000000000000cafe',
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeTwitterCheckin')
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(claimDailyTwitterCheckinMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
    })
    expect(res.statusCode).toBe(200)
  })
})
