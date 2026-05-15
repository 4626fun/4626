import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

const guardMock = vi.fn()
const issueAmoeNonceMock = vi.fn()
const buildAmoeEntryMessageMock = vi.fn()
const verifyAmoeEntryProofMock = vi.fn()
const createAmoeAttestationMock = vi.fn()
const buildProcessAmoeEntryCallMock = vi.fn()
const getAmoeCreditSnapshotMock = vi.fn()
const consumeAmoeCreditsForEntryMock = vi.fn()
const claimDailyTwitterCheckinMock = vi.fn()
const resolveAuthorizedWalletProfileMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getClientIpMock = vi.fn()
const rateLimitKeyMock = vi.fn()
const checkDurableRateLimitMock = vi.fn()
const verifyPrivyForAccountsMock = vi.fn()
const extractTweetIdFromInputMock = vi.fn()
const verifyTweetForAmoeMock = vi.fn()
const PROTOCOL_AMOE_CREATOR_COIN = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'

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

vi.mock('../../server/_lib/identity/accountsIdentity.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/_lib/identity/accountsIdentity.js')>()
  return {
    ...actual,
    verifyPrivyForAccounts: verifyPrivyForAccountsMock,
  }
})

vi.mock('../../server/twitter/verifyTweet.js', () => ({
  extractTweetIdFromInput: extractTweetIdFromInputMock,
  verifyTweetForAmoe: verifyTweetForAmoeMock,
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readBoundedJsonObjectBody: vi.fn(async (req: any) => req.body ?? null),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
}))

vi.mock('../../server/_lib/infra/durableRateLimit.js', () => ({
  checkDurableRateLimit: checkDurableRateLimitMock,
}))

// Default the durable rate-limit mock to a permissive response so legacy
// nonce / credits / twitter-checkin tests (which don't override it in their
// own beforeEach) keep passing under the new mock topology.
checkDurableRateLimitMock.mockResolvedValue({
  allowed: true,
  remaining: 5,
  resetAt: Date.now() + 60_000,
})

vi.mock('../../server/_lib/lottery/lotteryAmoe.js', () => ({
  AMOE_CREDITS_PER_ENTRY: 100,
  AMOE_MIN_POINTS_PER_SUBMISSION: 100,
  AMOE_MAX_POINTS_PER_SUBMISSION: 1_000_000,
  issueAmoeNonce: issueAmoeNonceMock,
  buildAmoeEntryMessage: buildAmoeEntryMessageMock,
  verifyAmoeEntryProof: verifyAmoeEntryProofMock,
  createAmoeAttestation: createAmoeAttestationMock,
  buildProcessAmoeEntryCall: buildProcessAmoeEntryCallMock,
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
    const xmtpCheckinHandler = await getV1ApiHandler('lottery/amoe/xmtp-checkin')
    expect(typeof nonceHandler).toBe('function')
    expect(typeof creditsHandler).toBe('function')
    expect(typeof submitHandler).toBe('function')
    expect(typeof checkinHandler).toBe('function')
    expect(typeof xmtpCheckinHandler).toBe('function')
  })
})

describe('AMOE nonce handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
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

  it('rejects missing wallet query param', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeNonce')
    const req = createMockReq({ method: 'GET', query: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('defaults missing creatorCoin to the protocol AMOE target', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeNonce')
    const req = createMockReq({
      method: 'GET',
      query: {
        wallet: '0x000000000000000000000000000000000000cAFe',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.creatorCoin).toBe(PROTOCOL_AMOE_CREATOR_COIN)
    expect(res.body?.data?.creatorCoinSource).toBe('protocol-default')
    expect(issueAmoeNonceMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
      creatorCoin: PROTOCOL_AMOE_CREATOR_COIN,
    })
    expect(buildAmoeEntryMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorCoin: PROTOCOL_AMOE_CREATOR_COIN,
      }),
    )
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

  it('resolves the authenticated canonical wallet when wallet is omitted', async () => {
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
      query: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(issueAmoeNonceMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
      creatorCoin: PROTOCOL_AMOE_CREATOR_COIN,
    })
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
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
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

  it('resolves credits from the authenticated canonical wallet when wallet is omitted', async () => {
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
      query: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(getAmoeCreditSnapshotMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
    })
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
  // PR 2 — the submit handler is now server-relay-only and accepts a
  // variable `pointsBurned` value. We stub the relay viem path to avoid
  // network I/O and assert the new request/response shape.
  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    getClientIpMock.mockReturnValue('127.0.0.1')
    rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
    verifyAmoeEntryProofMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      creatorCoin: '0x0000000000000000000000000000000000001001',
      nonce: '0x1111111111111111111111111111111111111111111111111111111111111111',
      expiresAt: '2026-03-01T00:10:00.000Z',
    })
    buildProcessAmoeEntryCallMock.mockResolvedValue({
      to: '0x77705A2f173dd52F28300447506Dc35086c34626',
      callData: '0xdeadbeef',
      pointsBurned: 1000,
      pointsBurnedAsUSD: '10000000',
      estimatedWinChancePPM: 40,
    })
    // Default the credit snapshot to a high balance so the new pre-flight
    // gate passes for legacy success-path tests. Tests that exercise the
    // gate override this with their own balance.
    getAmoeCreditSnapshotMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      credits: 1_000_000,
      creditsPerEntry: 100,
      entriesAvailable: 10_000,
      nextEntryAtCredits: 100,
    })
    consumeAmoeCreditsForEntryMock.mockResolvedValue({
      wallet: '0x000000000000000000000000000000000000cafe',
      consumed: 1000,
      creditsRemaining: 0,
      entriesAvailable: 0,
      creditsPerEntry: 100,
    })

    // Stub viem so the relay path returns a deterministic txHash without
    // touching the network. PR 2 drops client-relay so every successful
    // submit reaches this code path.
    process.env.LOTTERY_AMOE_RELAY_PRIVATE_KEY = '0x' + 'aa'.repeat(32)
    delete process.env.LOTTERY_AMOE_RELAY_SMART_WALLET
    delete process.env.LOTTERY_AMOE_RELAY_BUNDLER_URL
    vi.doMock('viem', () => ({
      createPublicClient: () => ({
        waitForTransactionReceipt: async () => ({ status: 'success' }),
      }),
      createWalletClient: () => ({
        sendTransaction: async () => '0xfeedface',
      }),
      getAddress: (a: string) => a,
      http: () => () => undefined,
    }))
    vi.doMock('viem/chains', () => ({ base: { id: 8453 } }))
    vi.doMock('viem/accounts', () => ({
      privateKeyToAccount: (pk: string) => ({
        address: '0x000000000000000000000000000000000000beef',
        source: pk,
      }),
    }))
  })

  it('rejects unsupported methods', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns server-relayed AMOE submit payload with variable points', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: '0x0000000000000000000000000000000000001001',
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 1000,
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.txHash).toBe('0xfeedface')
    expect(res.body?.data?.relayMode).toBe('server')
    expect(res.body?.data?.pointsBurned).toBe(1000)
    expect(res.body?.data?.pointsBurnedAsUSD).toBe('10000000')
    expect(res.body?.data?.estimatedWinChancePPM).toBe(40)
    expect(verifyAmoeEntryProofMock).toHaveBeenCalledTimes(1)
    expect(buildProcessAmoeEntryCallMock).toHaveBeenCalledWith(
      expect.objectContaining({ pointsBurned: 1000 }),
    )
    // Variable amount must be passed through to the credit ledger — not the
    // legacy fixed `AMOE_CREDITS_PER_ENTRY` constant.
    expect(consumeAmoeCreditsForEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({ requiredCredits: 1000 }),
    )
  })

  it('defaults omitted creatorCoin to the protocol AMOE target and only relays an entry', async () => {
    verifyAmoeEntryProofMock.mockResolvedValueOnce({
      wallet: '0x000000000000000000000000000000000000cafe',
      creatorCoin: PROTOCOL_AMOE_CREATOR_COIN,
      nonce: '0x2222222222222222222222222222222222222222222222222222222222222222',
      expiresAt: '2026-03-01T00:10:00.000Z',
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 1000,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(verifyAmoeEntryProofMock).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorCoin: PROTOCOL_AMOE_CREATOR_COIN,
      }),
    )
    expect(buildProcessAmoeEntryCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorCoin: PROTOCOL_AMOE_CREATOR_COIN,
        pointsBurned: 1000,
      }),
    )
    expect(consumeAmoeCreditsForEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredCredits: 1000,
        refId: `${PROTOCOL_AMOE_CREATOR_COIN}:0x2222222222222222222222222222222222222222222222222222222222222222`,
      }),
    )
    expect(res.body?.data?.txHash).toBe('0xfeedface')
    expect(res.body?.data).not.toHaveProperty('tokenAmount')
    expect(res.body?.data).not.toHaveProperty('tokensReceived')
  })

  it('rejects requests with missing pointsBurned', async () => {
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
    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toMatch(/pointsBurned/)
    expect(buildProcessAmoeEntryCallMock).not.toHaveBeenCalled()
    expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
  })

  it('rejects pointsBurned below the 100 floor', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: '0x0000000000000000000000000000000000001001',
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 99,
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(buildProcessAmoeEntryCallMock).not.toHaveBeenCalled()
  })

  it('rejects under-collateralized entries before relaying (P1 review fix)', async () => {
    // Regression for the P1 review finding: client requested 1_000_000
    // points (= $10K, 4% pre-boost) while only holding 100. Pre-fix the
    // handler relayed first and only failed the debit afterward, leaking
    // an on-chain entry. Post-fix the snapshot gate must reject before
    // any relay-side-effect.
    getAmoeCreditSnapshotMock.mockResolvedValueOnce({
      wallet: '0x000000000000000000000000000000000000cafe',
      credits: 100,
      creditsPerEntry: 100,
      entriesAvailable: 1,
      nextEntryAtCredits: 100,
    })
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: '0x0000000000000000000000000000000000001001',
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 1_000_000,
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(402)
    expect(String(res.body?.error ?? '')).toMatch(/insufficient/i)
    // The on-chain side-effect must NOT have happened.
    expect(buildProcessAmoeEntryCallMock).not.toHaveBeenCalled()
    expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
  })

  it('rejects pointsBurned above the 1M ceiling', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: '0x0000000000000000000000000000000000001001',
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 1_000_001,
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(buildProcessAmoeEntryCallMock).not.toHaveBeenCalled()
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
        pointsBurned: 100,
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
        pointsBurned: 100,
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
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x000000000000000000000000000000000000cafe' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
    verifyPrivyForAccountsMock.mockResolvedValue({
      privyUserId: 'did:privy:test',
      privyUser: {
        linkedAccounts: [
          {
            type: 'twitter_oauth',
            username: '4626fun',
            subject: '2012061207927406592',
          },
        ],
      },
    })
    extractTweetIdFromInputMock.mockReturnValue('1899868323524294692')
    verifyTweetForAmoeMock.mockResolvedValue({
      tweetId: '1899868323524294692',
      canonicalUrl: 'https://x.com/i/web/status/1899868323524294692',
      text: 'Checking in for 4626 Alternative Method of Entry. No purchase necessary. Earn points through eligible actions and use them for free jackpot entries. Join me: https://4626.fun',
      authorId: '2012061207927406592',
      authorUsername: '4626fun',
    })
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
    const req = createMockReq({ method: 'POST', body: { tweetUrl: 'https://x.com/4626fun/status/1899868323524294692' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.awardedCredits).toBe(1)
    expect(res.body?.data?.creditsPerEntry).toBe(100)
    expect(verifyTweetForAmoeMock).toHaveBeenCalledTimes(1)
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
    const req = createMockReq({ method: 'POST', body: { tweetId: '1899868323524294692' } })
    const res = createMockRes()

    await handler(req, res)

    expect(claimDailyTwitterCheckinMock).toHaveBeenCalledWith({
      wallet: '0x000000000000000000000000000000000000cafe',
      verifiedTweet: {
        tweetId: '1899868323524294692',
        tweetUrl: 'https://x.com/i/web/status/1899868323524294692',
        authorUsername: '4626fun',
        authorId: '2012061207927406592',
      },
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects missing or invalid tweet reference payload', async () => {
    extractTweetIdFromInputMock.mockReturnValueOnce(null)
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeTwitterCheckin')
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('invalid_tweet_reference')
  })

  it('rejects when twitter is not linked on the authenticated Privy profile', async () => {
    verifyPrivyForAccountsMock.mockResolvedValueOnce({
      privyUserId: 'did:privy:test',
      privyUser: { linkedAccounts: [] },
    })
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeTwitterCheckin')
    const req = createMockReq({ method: 'POST', body: { tweetId: '1899868323524294692' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toBe('twitter_not_linked')
  })
})

describe('AMOE daily XMTP checkin handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns gone for deprecated manual claim path', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeXmtpCheckin')
    const req = createMockReq({ method: 'POST', body: { messageId: 'msg-1' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(410)
    expect(res.body?.error).toBe('xmtp_checkin_auto_only')
  })
})
