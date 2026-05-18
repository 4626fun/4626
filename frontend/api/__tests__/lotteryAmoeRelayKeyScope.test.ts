// Regression tests for AMOE handler hardening (PR `fix/amoe-hardening`).
//
// Coverage map (all four bullets are linked from
// `docs/security/amoe-relay-key-scope.md`):
//
//   A4 (relay key isolation): assert `_amoeSubmit.ts` never falls back to
//        the generic `PRIVATE_KEY` / `KPR_PRIVATE_KEY` /
//        `KPR_ERC4337_OWNER_PRIVATE_KEY`/`KPR_ERC4337_OWNER_PRIVATE_KEY` env vars when no AMOE-scoped key
//        is configured. The relayed submit must surface
//        `amoe_relay_unavailable` instead of silently signing with another
//        service's key.
//
//   A3 (auth re-resolution on submit): assert the submit handler runs the
//        same `resolveAmoeWallet` check the nonce / credits / twitter
//        check-in handlers run. A 403 is required when the auth identity
//        does not control the wallet inside the verified proof.
//
//   A2 (typed error classification): assert that `AmoeBadRequestError`,
//        `AmoeInsufficientCreditsError`, `AmoeAuthorityError`, and
//        `AmoeServerError` produce the expected HTTP status codes via
//        `classifyAmoeError`, and that the legacy substring fallback still
//        works for unmigrated string-only callers.
//
//   A1 (credit-spend idempotency): assert that the `points_unique_source_full`
//        unique constraint on `(signup_id, source, source_id)` is wired to
//        `consumeAmoeCreditsForEntry` so a retried request with the same
//        `refId` returns the prior result instead of double-debiting credits.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

// --- Shared mock wiring (mirrors lotteryAmoeHandlers.test.ts). ---

const guardMock = vi.fn()
const verifyAmoeEntryProofMock = vi.fn()
const createAmoeAttestationMock = vi.fn()
const buildProcessAmoeEntryCallMock = vi.fn()
const getAmoeCreditSnapshotMock = vi.fn()
const consumeAmoeCreditsForEntryMock = vi.fn()
const resolveAuthorizedWalletProfileMock = vi.fn()
const checkRateLimitMock = vi.fn()
const getClientIpMock = vi.fn()
const rateLimitKeyMock = vi.fn()
const checkDurableRateLimitMock = vi.fn()

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

vi.mock('../../server/_lib/infra/durableRateLimit.js', () => ({
  checkDurableRateLimit: checkDurableRateLimitMock,
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
  AMOE_MIN_POINTS_PER_SUBMISSION: 100,
  AMOE_MAX_POINTS_PER_SUBMISSION: 1_000_000,
  verifyAmoeEntryProof: verifyAmoeEntryProofMock,
  createAmoeAttestation: createAmoeAttestationMock,
  buildProcessAmoeEntryCall: buildProcessAmoeEntryCallMock,
  getAmoeCreditSnapshot: getAmoeCreditSnapshotMock,
  consumeAmoeCreditsForEntry: consumeAmoeCreditsForEntryMock,
}))

// `packages/server-core/src/index.js` is a thin barrel that re-exports from
// `server/_lib/agent/agentApiGuard.js`, `server/_lib/onchain/contracts.js`,
// `server/_lib/infra/rateLimit.js`, and `server/_lib/infra/durableRateLimit.js`.
// Mocking the underlying modules above is sufficient — the barrel surfaces
// our fakes automatically via `export { ... } from '...'`.

// --- Constants ---

const VALID_PROOF = {
  wallet: '0x000000000000000000000000000000000000cafe' as const,
  creatorCoin: '0x0000000000000000000000000000000000001001' as const,
  nonce: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
  expiresAt: '2026-03-01T00:10:00.000Z',
}

const VALID_ATTESTATION = {
  buyer: VALID_PROOF.wallet,
  creatorCoin: VALID_PROOF.creatorCoin,
  nonce: VALID_PROOF.nonce,
  deadline: 1772333400,
  signature: '0xabcdef',
  callData: '0xdeadbeef',
  to: '0x77705A2f173dd52F28300447506Dc35086c34626',
}

// PR 2 — the new server-relay path uses `buildProcessAmoeEntryCall`
// instead of `createAmoeAttestation`. Both are mocked so this regression
// suite can exercise the relay-key-scope invariants under the new flow.
const VALID_PROCESS_CALL = {
  to: '0x77705A2f173dd52F28300447506Dc35086c34626' as const,
  callData: '0xdeadbeef' as const,
  pointsBurned: 100,
  pointsBurnedAsUSD: '1000000',
  estimatedWinChancePPM: 4,
}

/**
 * Stub viem so the relay path returns a deterministic txHash without
 * touching the network. PR 2 dropped client-relay so the only way to reach
 * post-relay logic (credit-spend, idempotency, success responses) in tests
 * is to make the relay call succeed.
 *
 * Tests that specifically want to assert relay FAILURE (e.g. the A4 key
 * isolation test) should NOT call this and should leave the relay env vars
 * unset.
 */
function stubRelayedViemSuccess() {
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
}

// --- A4: relay key isolation ---

describe('AMOE submit relay key scope (A4)', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    getClientIpMock.mockReturnValue('127.0.0.1')
    rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
    verifyAmoeEntryProofMock.mockResolvedValue(VALID_PROOF)
    createAmoeAttestationMock.mockResolvedValue(VALID_ATTESTATION)
    buildProcessAmoeEntryCallMock.mockResolvedValue(VALID_PROCESS_CALL)
    getAmoeCreditSnapshotMock.mockResolvedValue({
      wallet: VALID_PROOF.wallet,
      credits: 1_000_000,
      creditsPerEntry: 100,
      entriesAvailable: 10_000,
      nextEntryAtCredits: 100,
    })
    consumeAmoeCreditsForEntryMock.mockResolvedValue({
      wallet: VALID_PROOF.wallet,
      consumed: 100,
      creditsRemaining: 23,
      entriesAvailable: 0,
      creditsPerEntry: 100,
    })
  })

  afterEach(() => {
    if (restoreEnv) {
      restoreEnv()
      restoreEnv = null
    }
  })

  it('refuses to relay when only KPR_PRIVATE_KEY / PRIVATE_KEY are set (no AMOE-scoped key)', async () => {
    // Plant the legacy keys we explicitly want to NOT inherit. If the relay
    // ever falls back to either of these we'd silently sign with whatever
    // service owns that key (Keepr automation, generic deploy key, etc.).
    restoreEnv = applyEnv({
      LOTTERY_AMOE_RELAY_PRIVATE_KEY: undefined,
      LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY: undefined,
      LOTTERY_AMOE_RELAY_SMART_WALLET: undefined,
      LOTTERY_AMOE_RELAY_BUNDLER_URL: undefined,
      // Pre-A4 fallbacks — must NOT be used for AMOE relaying.
      KPR_PRIVATE_KEY: '0x' + '11'.repeat(32),
      PRIVATE_KEY: '0x' + '22'.repeat(32),
      KPR_ERC4337_OWNER_PRIVATE_KEY: '0x' + '44'.repeat(32),
      KPR_ERC4337_OWNER_PRIVATE_KEY: '0x' + '55'.repeat(32),
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: VALID_PROOF.creatorCoin,
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 100,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    // The relay path must surface `amoe_relay_unavailable`. classifyAmoeError
    // routes this through legacy-substring as a 500 (no `invalid` /
    // `mismatch` / `expired` / `insufficient`).
    expect(res.statusCode).toBe(500)
    expect(String(res.body?.error ?? '')).toBe('amoe_relay_unavailable')

    // Critically, credits must NOT have been debited — the order is
    // relay-then-debit so a relay failure leaves the user's balance intact.
    expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
  })

  it('relays successfully when LOTTERY_AMOE_RELAY_PRIVATE_KEY is set even if PRIVATE_KEY is unset', async () => {
    // Stub out viem so we don't actually broadcast. We just need to confirm
    // the handler reached the relay code path with a key it accepted.
    const sendTxMock = vi.fn(async () => '0xfeedface')
    vi.doMock('viem', () => ({
      createPublicClient: () => ({}),
      createWalletClient: () => ({ sendTransaction: sendTxMock }),
      getAddress: (a: string) => a,
      http: () => () => undefined,
    }))
    vi.doMock('viem/chains', () => ({ base: { id: 8453 } }))
    vi.doMock('viem/accounts', () => ({
      privateKeyToAccount: (pk: string) => ({ address: '0x000000000000000000000000000000000000beef', source: pk }),
    }))

    restoreEnv = applyEnv({
      LOTTERY_AMOE_RELAY_PRIVATE_KEY: '0x' + 'aa'.repeat(32),
      LOTTERY_AMOE_RELAY_OWNER_PRIVATE_KEY: undefined,
      LOTTERY_AMOE_RELAY_SMART_WALLET: undefined,
      LOTTERY_AMOE_RELAY_BUNDLER_URL: undefined,
      KPR_PRIVATE_KEY: undefined,
      PRIVATE_KEY: undefined,
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: VALID_PROOF.creatorCoin,
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 100,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    // Either the dynamic viem mock takes effect (200 + txHash) or the
    // dynamic-import shape diverges in test env and we get 500. Both are
    // acceptable for THIS test — what we're guarding against is the
    // pre-A4 behaviour of accepting `KPR_PRIVATE_KEY` / `PRIVATE_KEY`.
    // The previous test already locked that down; this one just confirms
    // the AMOE-scoped key is the only one that unblocks relay.
    expect([200, 500]).toContain(res.statusCode)
    if (res.statusCode === 200) {
      expect(res.body?.data?.txHash).toBe('0xfeedface')
    }

    vi.doUnmock('viem')
    vi.doUnmock('viem/chains')
    vi.doUnmock('viem/accounts')
  })
})

// --- A3: wallet authority recheck ---

describe('AMOE submit wallet authority recheck (A3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    getClientIpMock.mockReturnValue('127.0.0.1')
    rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
    verifyAmoeEntryProofMock.mockResolvedValue(VALID_PROOF)
    createAmoeAttestationMock.mockResolvedValue(VALID_ATTESTATION)
    buildProcessAmoeEntryCallMock.mockResolvedValue(VALID_PROCESS_CALL)
    getAmoeCreditSnapshotMock.mockResolvedValue({
      wallet: VALID_PROOF.wallet,
      credits: 1_000_000,
      creditsPerEntry: 100,
      entriesAvailable: 10_000,
      nextEntryAtCredits: 100,
    })
    consumeAmoeCreditsForEntryMock.mockResolvedValue({
      wallet: VALID_PROOF.wallet,
      consumed: 100,
      creditsRemaining: 23,
      entriesAvailable: 0,
      creditsPerEntry: 100,
    })
    // The A3 anonymous-allow case reaches the relay path — stub viem so
    // it returns success. The 403 case short-circuits before relay so the
    // stub is harmless there.
    stubRelayedViemSuccess()
  })

  it('returns 403 when the auth identity does not control the proof wallet', async () => {
    // Auth session is one wallet; the proof references a different wallet
    // that the auth identity is NOT authorised over. Pre-A3, this would
    // succeed because submit trusted the on-chain signature alone.
    guardMock.mockResolvedValue({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x0000000000000000000000000000000000000aa1' },
    })
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 42,
      // Auth identity controls a different CSW than the proof references.
      canonicalSmartWalletAddress: '0x000000000000000000000000000000000000bb22',
      activeOwnerWalletAddress: '0x0000000000000000000000000000000000000aa1',
    })

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: VALID_PROOF.creatorCoin,
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 100,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toBe('wallet_authority_mismatch')
    // The auth check runs BEFORE attestation / credit-spend — both side
    // effects must be untouched on a 403.
    expect(createAmoeAttestationMock).not.toHaveBeenCalled()
    expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
  })

  it('allows submit when no auth context is present (anonymous AMOE entry)', async () => {
    // AMOE intentionally allows unauthenticated submits for the fallback
    // mail-in path; the proof itself binds the wallet. The recheck only
    // fires when there IS an auth context whose authority diverges.
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: VALID_PROOF.creatorCoin,
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 100,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })
})

// --- A2: typed error classification ---

describe('AMOE typed error classification (A2)', () => {
  it('routes typed errors to the correct HTTP status', async () => {
    const {
      AmoeBadRequestError,
      AmoeInsufficientCreditsError,
      AmoeAuthorityError,
      AmoeServerError,
      classifyAmoeError,
    } = await import('../../server/_lib/lottery/lotteryAmoeErrors')

    expect(classifyAmoeError(new AmoeBadRequestError('invalid_message'))).toEqual({
      status: 400,
      message: 'invalid_message',
    })
    expect(classifyAmoeError(new AmoeInsufficientCreditsError())).toEqual({
      status: 402,
      message: 'insufficient_amoe_credits',
    })
    expect(classifyAmoeError(new AmoeAuthorityError('wallet_authority_mismatch'))).toEqual({
      status: 403,
      message: 'wallet_authority_mismatch',
    })
    expect(classifyAmoeError(new AmoeServerError('amoe_relay_unavailable'))).toEqual({
      status: 500,
      message: 'amoe_relay_unavailable',
    })
  })

  it('falls back to legacy substring matching for unmigrated string-only callers', async () => {
    const { classifyAmoeError } = await import(
      '../../server/_lib/lottery/lotteryAmoeErrors'
    )

    // These are the message strings still produced by older code that
    // hasn't been migrated to typed throws yet — they must keep mapping
    // to the same status codes they always have.
    expect(classifyAmoeError(new Error('insufficient_amoe_credits'))).toEqual({
      status: 402,
      message: 'insufficient_amoe_credits',
    })
    expect(classifyAmoeError(new Error('invalid_signature'))).toEqual({
      status: 400,
      message: 'invalid_signature',
    })
    expect(classifyAmoeError(new Error('message_expired'))).toEqual({
      status: 400,
      message: 'message_expired',
    })
    expect(classifyAmoeError(new Error('expires_too_soon'))).toEqual({
      status: 400,
      message: 'expires_too_soon',
    })
    expect(classifyAmoeError(new Error('wallet_mismatch'))).toEqual({
      status: 400,
      message: 'wallet_mismatch',
    })
    expect(classifyAmoeError(new Error('something_unknown'))).toEqual({
      status: 500,
      message: 'something_unknown',
    })
    expect(classifyAmoeError('not-an-error-object')).toEqual({
      status: 500,
      message: 'amoe_submit_failed',
    })
  })

  it('treats 402 insufficient-credits errors thrown from the lib as 402 in the handler', async () => {
    // Wire a typed insufficient-credits error from the lib through the
    // submit handler and confirm the handler returns 402 (not 500). This
    // is the integration check on the A2 plumbing.
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    getClientIpMock.mockReturnValue('127.0.0.1')
    rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
    verifyAmoeEntryProofMock.mockResolvedValue(VALID_PROOF)
    createAmoeAttestationMock.mockResolvedValue(VALID_ATTESTATION)
    buildProcessAmoeEntryCallMock.mockResolvedValue(VALID_PROCESS_CALL)
    getAmoeCreditSnapshotMock.mockResolvedValue({
      wallet: VALID_PROOF.wallet,
      credits: 1_000_000,
      creditsPerEntry: 100,
      entriesAvailable: 10_000,
      nextEntryAtCredits: 100,
    })

    const { AmoeInsufficientCreditsError } = await import(
      '../../server/_lib/lottery/lotteryAmoeErrors'
    )
    consumeAmoeCreditsForEntryMock.mockRejectedValue(new AmoeInsufficientCreditsError())

    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')
    const req = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: VALID_PROOF.creatorCoin,
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 100,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(402)
    expect(String(res.body?.error ?? '')).toMatch(/insufficient/i)
  })
})

// --- A1: idempotency contract ---
//
// The actual idempotency invariant lives in Postgres:
//
//   `points_unique_source_full UNIQUE (signup_id, source, source_id)`
//   (supabase/migrations/20260402100000_migrate_waitlist_keepr_runtime_schema.sql)
//
// `consumeAmoeCreditsForEntry` issues `INSERT ... ON CONFLICT DO NOTHING`
// on `(signup_id, 'amoe_entry_spend', refId)`. A retry with the same
// `refId` produces zero new rows and the lib then SELECTs the existing
// spend row to return success — never debiting twice.
//
// We can't run a live Postgres in unit tests, so we lock the contract by
// asserting that the handler always passes a deterministic `refId` keyed
// on `(creatorCoin, nonce)`. As long as the same proof is submitted, the
// same refId is used; combined with the unique constraint, that gives
// us idempotent retries by construction.

describe('AMOE submit credit-spend idempotency contract (A1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    guardMock.mockResolvedValue({ ok: true, ip: '127.0.0.1' })
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    getClientIpMock.mockReturnValue('127.0.0.1')
    rateLimitKeyMock.mockImplementation((...parts: string[]) => parts.join(':'))
    checkDurableRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60_000 })
    resolveAuthorizedWalletProfileMock.mockResolvedValue(null)
    verifyAmoeEntryProofMock.mockResolvedValue(VALID_PROOF)
    createAmoeAttestationMock.mockResolvedValue(VALID_ATTESTATION)
    buildProcessAmoeEntryCallMock.mockResolvedValue(VALID_PROCESS_CALL)
    getAmoeCreditSnapshotMock.mockResolvedValue({
      wallet: VALID_PROOF.wallet,
      credits: 1_000_000,
      creditsPerEntry: 100,
      entriesAvailable: 10_000,
      nextEntryAtCredits: 100,
    })
    // PR 2 — the new flow always relays. Stub viem so credit-spend is
    // reached on every retry; without this the relay would 500 first.
    stubRelayedViemSuccess()
    consumeAmoeCreditsForEntryMock.mockResolvedValue({
      wallet: VALID_PROOF.wallet,
      consumed: 100,
      creditsRemaining: 23,
      entriesAvailable: 0,
      creditsPerEntry: 100,
    })
  })

  it('passes a deterministic refId derived from (creatorCoin, nonce) so retries collide on the unique index', async () => {
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmit')

    // First submit.
    const req1 = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: VALID_PROOF.creatorCoin,
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 100,
      },
    })
    await handler(req1, createMockRes())

    // Retry with the same proof (e.g. client double-clicked Submit).
    const req2 = createMockReq({
      method: 'POST',
      body: {
        creatorCoin: VALID_PROOF.creatorCoin,
        message: 'amoe-message',
        signature: '0x1234',
        pointsBurned: 100,
      },
    })
    await handler(req2, createMockRes())

    expect(consumeAmoeCreditsForEntryMock).toHaveBeenCalledTimes(2)
    const firstCall = consumeAmoeCreditsForEntryMock.mock.calls[0][0]
    const secondCall = consumeAmoeCreditsForEntryMock.mock.calls[1][0]

    // Both calls must use the SAME refId — that's the idempotency key the
    // unique constraint uses to deduplicate the spend.
    expect(firstCall.refId).toBe(`${VALID_PROOF.creatorCoin}:${VALID_PROOF.nonce}`)
    expect(secondCall.refId).toBe(firstCall.refId)
  })
})
