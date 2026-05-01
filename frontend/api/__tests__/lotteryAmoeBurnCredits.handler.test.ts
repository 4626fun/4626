// PR 6a — `_amoeBurnCredits` handler integration tests.
//
// Coverage:
//   1. Routing — `lottery/amoe/burn-credits` resolves to a function.
//   2. Feature-flag closed (default) → 503 `burn_credits_disabled`.
//   3. Method enforcement (only POST).
//   4. Body validation — bad creatorCoin / nonce / message / signature /
//      twitterHandle / spendRefId / pointsBurned all 400 with the
//      handler's specific error string.
//   5. Lottery manager mismatch in message → 400.
//   6. Auth/profile gating — non-safe-integer profileId → 403.
//   7. Message binding — wallet/creator/nonce/chain/expiry mismatches
//      surface as 400 with typed error codes.
//   8. Signature verification failure → 400 `signature_invalid`.
//   9. Insufficient credits → 402 `insufficient_amoe_credits`.
//  10. Happy path — returns 200 with `spendRefId`, `burnEpoch`,
//      `eligibleSubmitAfterUnixSec`, `creditsRemaining`.
//  11. Idempotent retry — second call with the same `spendRefId`
//      returns the same balances (no double-debit). The data-layer
//      idempotence is tested separately in `lotteryAmoe.test.ts`;
//      this asserts the handler does NOT add a layer that breaks it.
//  12. `eligibleSubmitAfterUnixSec` math — equals
//      `(burnEpoch + 1) * AMOE_EPOCH_LENGTH_SECONDS + AMOE_EPOCH_GENESIS_SECONDS`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  guardMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  checkDurableRateLimitMock,
  resolveAmoeWalletMock,
  verifyAmoeWalletSignatureMock,
  getAmoeCreditSnapshotMock,
  consumeAmoeCreditsForEntryMock,
} = vi.hoisted(() => ({
  guardMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(),
  rateLimitKeyMock: vi.fn(),
  checkDurableRateLimitMock: vi.fn(),
  resolveAmoeWalletMock: vi.fn(),
  verifyAmoeWalletSignatureMock: vi.fn(),
  getAmoeCreditSnapshotMock: vi.fn(),
  consumeAmoeCreditsForEntryMock: vi.fn(),
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: guardMock,
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

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readBoundedJsonObjectBody: vi.fn(async (req: any) => req.body ?? null),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
}))

vi.mock('../../server/_lib/infra/durableRateLimit.js', () => ({
  checkDurableRateLimit: checkDurableRateLimitMock,
}))

vi.mock('../../server/_lib/lottery/amoeWalletResolver.js', () => ({
  resolveAmoeWallet: resolveAmoeWalletMock,
}))

vi.mock('../../server/_lib/onchain/contracts.js', () => ({
  getApiContracts: () => ({
    lotteryManager: '0x77705a2f173dd52f28300447506dc35086c34626',
  }),
}))

// `parseAmoeEntryMessage` mirrors the production parser. Inline for
// hermetic-unit reasons (same convention as the submit-zk handler test).
function buildTestEntryMessage(fields: {
  wallet: `0x${string}`
  creatorCoin: `0x${string}`
  nonce: `0x${string}`
  issuedAt: string
  expiresAt: string
  chainId: number
  lotteryManager: `0x${string}`
}): string {
  return [
    'Perplexity AMOE Entry',
    '',
    `Wallet: ${fields.wallet}`,
    `Creator: ${fields.creatorCoin}`,
    `Nonce: ${fields.nonce}`,
    `Chain: ${fields.chainId}`,
    `LotteryManager: ${fields.lotteryManager}`,
    `IssuedAt: ${fields.issuedAt}`,
    `ExpiresAt: ${fields.expiresAt}`,
  ].join('\n')
}

const { parseTestEntryMessage } = vi.hoisted(() => {
  function parseTestEntryMessage(message: string): {
    wallet: `0x${string}`
    creatorCoin: `0x${string}`
    nonce: `0x${string}`
    chainId: number
    lotteryManager: `0x${string}`
    issuedAt: string
    expiresAt: string
  } | null {
    const lines = message.split('\n')
    if (lines[0] !== 'Perplexity AMOE Entry') return null
    const map: Record<string, string> = {}
    for (const line of lines.slice(2)) {
      const idx = line.indexOf(':')
      if (idx <= 0) continue
      const k = line.slice(0, idx).trim()
      const v = line.slice(idx + 1).trim()
      map[k] = v
    }
    if (
      !map.Wallet ||
      !map.Creator ||
      !map.Nonce ||
      !map.Chain ||
      !map.LotteryManager ||
      !map.IssuedAt ||
      !map.ExpiresAt
    ) {
      return null
    }
    return {
      wallet: map.Wallet.toLowerCase() as `0x${string}`,
      creatorCoin: map.Creator.toLowerCase() as `0x${string}`,
      nonce: map.Nonce.toLowerCase() as `0x${string}`,
      chainId: Number(map.Chain),
      lotteryManager: map.LotteryManager.toLowerCase() as `0x${string}`,
      issuedAt: map.IssuedAt,
      expiresAt: map.ExpiresAt,
    }
  }
  return { parseTestEntryMessage }
})

vi.mock('../../server/_lib/lottery/lotteryAmoe.js', () => ({
  AMOE_MIN_POINTS_PER_SUBMISSION: 100,
  AMOE_MAX_POINTS_PER_SUBMISSION: 1_000_000,
  consumeAmoeCreditsForEntry: consumeAmoeCreditsForEntryMock,
  getAmoeCreditSnapshot: getAmoeCreditSnapshotMock,
  verifyAmoeWalletSignature: verifyAmoeWalletSignatureMock,
  parseAmoeEntryMessage: parseTestEntryMessage,
}))

// PR 6c P1 hotfix v2 (Codex follow-up): the phase-A intent marker is
// now written ATOMICALLY by `consumeAmoeCreditsForEntry`'s debit CTE in
// the lib layer, NOT by a follow-up INSERT in the handler. So the
// handler no longer touches `db/postgres.js` directly and we don't need
// to mock it here. Lib-layer atomicity is covered by the SQL canary in
// `server/_lib/__tests__/lotteryAmoe.consumeAmoeCreditsForEntry.test.ts`
// (intent_ins CTE assertion) plus the orphan-refund canary in
// `server/_lib/__tests__/amoeBurnRefund.test.ts`.

import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_CREATOR = '0x0000000000000000000000000000000000001001'
const VALID_NONCE = `0x${'ab'.repeat(32)}`
const VALID_SIG = `0x${'cd'.repeat(65)}`
const CANONICAL_WALLET = '0x000000000000000000000000000000000000cafe'
const LOTTERY_MANAGER = '0x77705a2f173dd52f28300447506dc35086c34626'
const PROFILE_ID = 42

function buildValidMessage(
  overrides: Partial<{
    wallet: `0x${string}`
    creatorCoin: `0x${string}`
    nonce: `0x${string}`
    issuedAt: string
    expiresAt: string
    chainId: number
    lotteryManager: `0x${string}`
  }> = {},
): string {
  return buildTestEntryMessage({
    wallet: CANONICAL_WALLET as `0x${string}`,
    creatorCoin: VALID_CREATOR as `0x${string}`,
    nonce: VALID_NONCE as `0x${string}`,
    issuedAt: '2026-04-29T00:00:00.000Z',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    chainId: 8453,
    lotteryManager: LOTTERY_MANAGER as `0x${string}`,
    ...overrides,
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    creatorCoin: VALID_CREATOR,
    message: buildValidMessage(),
    signature: VALID_SIG,
    pointsBurned: 250,
    nonce: VALID_NONCE,
    twitterHandle: 'wenakita',
    spendRefId: 'idem-2026-04-29-aaaa',
    ...overrides,
  }
}

function setEnabledEnv(): () => void {
  const prior = process.env.AMOE_BURN_CREDITS_ENABLED
  process.env.AMOE_BURN_CREDITS_ENABLED = '1'
  return () => {
    if (prior === undefined) delete process.env.AMOE_BURN_CREDITS_ENABLED
    else process.env.AMOE_BURN_CREDITS_ENABLED = prior
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  guardMock.mockResolvedValue({
    ok: true,
    ip: '127.0.0.1',
    auth: { type: 'session', address: '0x0000000000000000000000000000000000000aa1' },
  })
  checkRateLimitMock.mockReturnValue({
    allowed: true,
    remaining: 39,
    resetAt: Date.now() + 60_000,
  })
  getClientIpMock.mockReturnValue('127.0.0.1')
  rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
  checkDurableRateLimitMock.mockResolvedValue({
    allowed: true,
    remaining: 5,
    resetAt: Date.now() + 60_000,
  })
  resolveAmoeWalletMock.mockResolvedValue({
    ok: true,
    value: {
      wallet: CANONICAL_WALLET,
      profileId: PROFILE_ID,
      canonicalSmartWalletAddress: CANONICAL_WALLET,
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    },
  })
  verifyAmoeWalletSignatureMock.mockResolvedValue(true)
  getAmoeCreditSnapshotMock.mockResolvedValue({
    wallet: CANONICAL_WALLET,
    credits: 1000,
    creditsPerEntry: 100,
    entriesAvailable: 10,
    nextEntryAtCredits: 100,
  })
  consumeAmoeCreditsForEntryMock.mockResolvedValue({
    wallet: CANONICAL_WALLET,
    consumed: 250,
    creditsRemaining: 750,
    creditsPerEntry: 100,
    entriesAvailable: 7,
    // Per Fix #2: lib sources `burnedAt` / `burnEpoch` from the
    // persisted `points` row (in BOTH new-insert and idempotent-retry
    // paths), so the handler should pass these through verbatim and
    // NOT recompute from `Date.now()`.
    burnedAt: '2026-04-29T12:00:00.000Z',
    burnEpoch: '17',
    // PR 6c P1 hotfix v2: lib still returns the resolved profile id and
    // canonical spendRefId (they're observable side outputs of the debit
    // CTE), but the handler no longer needs them — the intent row is
    // written atomically inside `consumeAmoeCreditsForEntry` itself.
    // Kept on the mock contract so any future regression that asserts
    // these fields stays green.
    signupId: PROFILE_ID,
    spendRefId: 'idem-2026-04-29-aaaa',
  })
})

async function callBurn(body: unknown, opts: { method?: string } = {}) {
  const handler = await getV1ApiHandler('lottery/amoe/burn-credits')
  if (!handler) throw new Error('handler not registered')
  const req = createMockReq({ method: opts.method ?? 'POST', body })
  const res = createMockRes()
  await handler(req, res)
  return { req, res }
}

// ---------------------------------------------------------------------------
// 1. Routing
// ---------------------------------------------------------------------------

describe('lottery/amoe/burn-credits — routing', () => {
  it('resolves to a function', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/burn-credits')
    expect(typeof handler).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// 2. Feature flag
// ---------------------------------------------------------------------------

describe('lottery/amoe/burn-credits — feature flag', () => {
  it('returns 503 burn_credits_disabled when AMOE_BURN_CREDITS_ENABLED is not set', async () => {
    const prior = process.env.AMOE_BURN_CREDITS_ENABLED
    delete process.env.AMOE_BURN_CREDITS_ENABLED
    try {
      const { res } = await callBurn(validBody())
      expect(res.statusCode).toBe(503)
      expect(res.body).toEqual({ success: false, error: 'burn_credits_disabled' })
    } finally {
      if (prior !== undefined) process.env.AMOE_BURN_CREDITS_ENABLED = prior
    }
  })
})

// ---------------------------------------------------------------------------
// 3-12. Behavior with feature flag on
// ---------------------------------------------------------------------------

describe('lottery/amoe/burn-credits — enabled', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    restoreEnv = setEnabledEnv()
  })

  afterEach(() => {
    restoreEnv()
  })

  // 3
  it('rejects non-POST methods with 405', async () => {
    const { res } = await callBurn(validBody(), { method: 'GET' })
    expect(res.statusCode).toBe(405)
  })

  // 4 — body validation
  describe('body validation', () => {
    it('400 on missing creatorCoin', async () => {
      const { res } = await callBurn(validBody({ creatorCoin: 'not-an-address' }))
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toMatch(/creatorCoin/)
    })

    it('400 on missing message', async () => {
      const { res } = await callBurn(validBody({ message: '' }))
      expect(res.statusCode).toBe(400)
    })

    it('400 on bad signature shape', async () => {
      const { res } = await callBurn(validBody({ signature: 'no-prefix' }))
      expect(res.statusCode).toBe(400)
    })

    it('400 on bad nonce shape', async () => {
      const { res } = await callBurn(validBody({ nonce: '0xnotbytes32' }))
      expect(res.statusCode).toBe(400)
    })

    it('400 on missing twitterHandle / spendRefId', async () => {
      const { res } = await callBurn(validBody({ twitterHandle: '' }))
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toMatch(/twitterHandle|spendRefId/)
    })

    it('400 on out-of-range pointsBurned', async () => {
      const low = await callBurn(validBody({ pointsBurned: 50 }))
      expect(low.res.statusCode).toBe(400)
      const high = await callBurn(validBody({ pointsBurned: 1_000_001 }))
      expect(high.res.statusCode).toBe(400)
    })

    it('400 on non-integer pointsBurned', async () => {
      const { res } = await callBurn(validBody({ pointsBurned: 250.5 }))
      expect(res.statusCode).toBe(400)
    })
  })

  // 5
  it('400 lottery_manager_mismatch when message binds wrong lottery manager', async () => {
    const wrongManagerMessage = buildValidMessage({
      lotteryManager:
        '0x0000000000000000000000000000000000000000' as `0x${string}`,
    })
    const { res } = await callBurn(validBody({ message: wrongManagerMessage }))
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('lottery_manager_mismatch')
  })

  // 6
  it('403 amoe_profile_unresolved when profileId is non-safe-integer', async () => {
    resolveAmoeWalletMock.mockResolvedValueOnce({
      ok: true,
      value: {
        wallet: CANONICAL_WALLET,
        profileId: Number.MAX_SAFE_INTEGER + 2, // unsafe
      },
    })
    const { res } = await callBurn(validBody())
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('amoe_profile_unresolved')
  })

  // 7 — message binding mismatches
  describe('message binding', () => {
    it('400 wallet_mismatch when message wallet ≠ resolved wallet', async () => {
      const m = buildValidMessage({
        wallet: '0x000000000000000000000000000000000000aaaa' as `0x${string}`,
      })
      const { res } = await callBurn(validBody({ message: m }))
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('wallet_mismatch')
    })

    it('400 creator_mismatch when message creator ≠ body creator', async () => {
      const m = buildValidMessage({
        creatorCoin: '0x0000000000000000000000000000000000002002' as `0x${string}`,
      })
      const { res } = await callBurn(validBody({ message: m }))
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('creator_mismatch')
    })

    it('400 nonce_mismatch when message nonce ≠ body nonce', async () => {
      const m = buildValidMessage({ nonce: `0x${'12'.repeat(32)}` as `0x${string}` })
      const { res } = await callBurn(validBody({ message: m }))
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('nonce_mismatch')
    })

    it('400 invalid_chain when message chainId ≠ 8453', async () => {
      const m = buildValidMessage({ chainId: 1 })
      const { res } = await callBurn(validBody({ message: m }))
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('invalid_chain')
    })

    it('400 message_expired when expiresAt is in the past', async () => {
      const m = buildValidMessage({
        expiresAt: new Date(Date.now() - 1).toISOString(),
      })
      const { res } = await callBurn(validBody({ message: m }))
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toBe('message_expired')
    })
  })

  // 8
  it('400 signature_invalid when verifyAmoeWalletSignature returns false', async () => {
    verifyAmoeWalletSignatureMock.mockResolvedValueOnce(false)
    const { res } = await callBurn(validBody())
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('signature_invalid')
  })

  // 9
  it('402 insufficient_amoe_credits when balance < pointsBurned', async () => {
    getAmoeCreditSnapshotMock.mockResolvedValueOnce({
      wallet: CANONICAL_WALLET,
      credits: 100, // < pointsBurned (250)
      creditsPerEntry: 100,
      entriesAvailable: 1,
      nextEntryAtCredits: 100,
    })
    const { res } = await callBurn(validBody())
    expect(res.statusCode).toBe(402)
    expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
  })

  // 10 — happy path
  it('200 on happy path with the expected envelope', async () => {
    const { res } = await callBurn(validBody())
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.spendRefId).toBe('idem-2026-04-29-aaaa')
    expect(res.body.data.consumed).toBe(250)
    expect(res.body.data.creditsRemaining).toBe(750)
    expect(res.body.data.creditsPerEntry).toBe(100)
    expect(res.body.data.entriesAvailable).toBe(7)
    expect(typeof res.body.data.burnEpoch).toBe('string')
    expect(typeof res.body.data.eligibleSubmitAfterUnixSec).toBe('number')
    expect(typeof res.body.data.burnedAt).toBe('string')
    // Fix #2: handler MUST forward burnedAt/burnEpoch from the lib
    // (persisted row) instead of recomputing from `Date.now()`.
    expect(res.body.data.burnedAt).toBe('2026-04-29T12:00:00.000Z')
    expect(res.body.data.burnEpoch).toBe('17')

    expect(consumeAmoeCreditsForEntryMock).toHaveBeenCalledTimes(1)
    const arg = consumeAmoeCreditsForEntryMock.mock.calls[0]?.[0]
    expect(arg).toMatchObject({
      wallet: CANONICAL_WALLET,
      requiredCredits: 250,
      refId: 'idem-2026-04-29-aaaa',
    })
  })

  // 11 — idempotent retry
  it('passes the same spendRefId on repeat calls (data-layer dedupes the burn)', async () => {
    // First call.
    await callBurn(validBody())
    // Second call with the same spendRefId — the underlying module
    // returns the same balances unchanged when the partial unique
    // index hits.
    consumeAmoeCreditsForEntryMock.mockResolvedValueOnce({
      wallet: CANONICAL_WALLET,
      consumed: 250,
      creditsRemaining: 750,
      creditsPerEntry: 100,
      entriesAvailable: 7,
      burnedAt: '2026-04-29T12:00:00.000Z',
      burnEpoch: '17',
      signupId: PROFILE_ID,
      spendRefId: 'idem-2026-04-29-aaaa',
    })
    const { res } = await callBurn(validBody())
    expect(res.statusCode).toBe(200)
    expect(consumeAmoeCreditsForEntryMock).toHaveBeenCalledTimes(2)
    const firstRefId = consumeAmoeCreditsForEntryMock.mock.calls[0]?.[0]?.refId
    const secondRefId = consumeAmoeCreditsForEntryMock.mock.calls[1]?.[0]?.refId
    expect(secondRefId).toBe(firstRefId)
  })

  // 11b — Fix #2: stable burnEpoch/burnedAt across retries
  //
  // The risk this guards: if the handler computed `burnEpoch` from
  // `Date.now()` at response time (the original bug), then a retry
  // that crosses an epoch boundary would tell the client to wait an
  // extra epoch even though the burn is already eligible. The lib
  // returns the persisted-row epoch in BOTH calls; the handler must
  // pass it through unchanged.
  it('returns the SAME burnEpoch / burnedAt on idempotent retry, even if wall-clock has moved', async () => {
    // First call: lib returns epoch=17 (the persisted-row epoch).
    const first = await callBurn(validBody())
    expect(first.res.statusCode).toBe(200)
    expect(first.res.body.data.burnEpoch).toBe('17')
    expect(first.res.body.data.burnedAt).toBe('2026-04-29T12:00:00.000Z')
    const firstEligible = first.res.body.data.eligibleSubmitAfterUnixSec

    // Second call: lib returns SAME epoch=17 (idempotent SELECT path),
    // even though the test could have been on either side of an
    // epoch boundary. The handler must NOT recompute from wall-clock.
    consumeAmoeCreditsForEntryMock.mockResolvedValueOnce({
      wallet: CANONICAL_WALLET,
      consumed: 250,
      creditsRemaining: 750,
      creditsPerEntry: 100,
      entriesAvailable: 7,
      burnedAt: '2026-04-29T12:00:00.000Z',
      burnEpoch: '17',
      signupId: PROFILE_ID,
      spendRefId: 'idem-2026-04-29-aaaa',
    })
    const second = await callBurn(validBody())
    expect(second.res.statusCode).toBe(200)
    expect(second.res.body.data.burnEpoch).toBe('17')
    expect(second.res.body.data.burnedAt).toBe('2026-04-29T12:00:00.000Z')
    expect(second.res.body.data.eligibleSubmitAfterUnixSec).toBe(firstEligible)
  })

  // 11c — Fix #1: non-parseable expiresAt is rejected as expired
  //
  // `Date.parse('not-a-date')` is NaN, and `NaN <= Date.now()` is
  // false. Without `Number.isFinite`, the expiry check would let
  // such payloads through, weakening the replay-window contract.
  it('400 message_expired when expiresAt is not a parseable date', async () => {
    const m = buildValidMessage({ expiresAt: 'not-a-date' })
    const { res } = await callBurn(validBody({ message: m }))
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('message_expired')
    // Burn must NOT have been attempted for an unparseable expiry.
    expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
  })

  // 12 — eligibleSubmitAfterUnixSec math
  it('eligibleSubmitAfterUnixSec equals (burnEpoch + 1) * 86400 + genesis', async () => {
    const { res } = await callBurn(validBody())
    expect(res.statusCode).toBe(200)
    const burnEpoch = BigInt(res.body.data.burnEpoch)
    const eligible = BigInt(res.body.data.eligibleSubmitAfterUnixSec)
    const AMOE_EPOCH_GENESIS = 1_777_507_200n
    const AMOE_EPOCH_LENGTH = 86_400n
    expect(eligible).toBe(AMOE_EPOCH_GENESIS + (burnEpoch + 1n) * AMOE_EPOCH_LENGTH)
  })
})
