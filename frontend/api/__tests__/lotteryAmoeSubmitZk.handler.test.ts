// PR 3 — `_amoeSubmitZk` handler integration tests.
//
// Coverage:
//   1. Feature-flag closed (default) → 503 `zk_path_disabled`.
//   2. Routing — `lottery/amoe/submit-zk` resolves to a function.
//   3. Method enforcement (only POST).
//   4. Body validation — bad creatorCoin / nonce / message / signature /
//      twitterHandle / spendRefId / pointsBurned all 400 with the
//      handler's specific error string.
//   5. Lottery router env unset → 503 `Lottery manager not configured`.
//   6. Auth/profile gating — when `resolveAmoeWallet` succeeds but
//      `profileId` is null/zero/non-safe-integer, return 403 with
//      `amoe_profile_unresolved`. (Per Codex review on #439: a JS
//      `number` profileId above `Number.MAX_SAFE_INTEGER` would alias
//      distinct Postgres bigint rows to the same `signupIdHash`,
//      corrupting nullifier / replay identity.)
//   7. Message binding — the EIP-191 message must parse and bind to
//      (wallet, creatorCoin, nonce, chainId, lotteryManager, expiresAt).
//      Mismatches surface as 400 with the typed error code. (Per Codex
//      review on #439: a leaked/old wallet signature over any string
//      from the same wallet could be replayed with fresh nonces if the
//      message is treated as opaque bytes.)
//   8. Signature verification — failure surfaces as 400 `signature_invalid`.
//   9. Nonce reuse → 409-equivalent `nonce_already_used` (code 400 in
//      `classifyAmoeError`'s default mapping; checked via response body).
//  10. Insufficient credits → 402 `insufficient_amoe_credits`.
//  11. Happy path — orchestration + relay + credit-debit produce a 200
//      with `proofMode: 'plonk'`, `epoch`, `txHash`.
//  12. AmoeProofGenerationError → 422 with the typed error code.
//
// Mocking strategy:
//   * Mock every external collaborator (auth guard, rate limit, db, sig
//     verify, snapshot, credit debit, nonce store).
//   * Use `__setAmoeSubmitZkHandlerHooksForTest` to inject the
//     orchestration + relay seam — that's the explicit test API the
//     handler exposes for this purpose.

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  guardMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  checkDurableRateLimitMock,
  resolveAmoeWalletMock,
  verifyAmoeWalletSignatureMock,
  consumeAmoeNonceForSubmitMock,
  getAmoeCreditSnapshotMock,
  consumeAmoeCreditsForEntryMock,
  insertPendingMock,
  markProvenMock,
  markBroadcastingMock,
  markSettledMock,
  markManagerDeclinedMock,
  markRejectedChainMock,
  markProveFailedMock,
  findActiveByNonceCommitMock,
} = vi.hoisted(() => ({
  guardMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getClientIpMock: vi.fn(),
  rateLimitKeyMock: vi.fn(),
  checkDurableRateLimitMock: vi.fn(),
  resolveAmoeWalletMock: vi.fn(),
  verifyAmoeWalletSignatureMock: vi.fn(),
  consumeAmoeNonceForSubmitMock: vi.fn(),
  getAmoeCreditSnapshotMock: vi.fn(),
  consumeAmoeCreditsForEntryMock: vi.fn(),
  insertPendingMock: vi.fn(),
  markProvenMock: vi.fn(),
  markBroadcastingMock: vi.fn(),
  markSettledMock: vi.fn(),
  markManagerDeclinedMock: vi.fn(),
  markRejectedChainMock: vi.fn(),
  markProveFailedMock: vi.fn(),
  findActiveByNonceCommitMock: vi.fn(),
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

vi.mock('../../server/_lib/lottery/amoeNonceStore.js', () => ({
  consumeAmoeNonceForSubmit: consumeAmoeNonceForSubmitMock,
}))

// PR 4 — replay store. The handler now threads (insertPending →
// markProven → markBroadcasting → markSettled) through the submit
// path, with a markProveFailed branch on orchestration failure. We
// mock the whole module so tests don't need a real DB.
vi.mock('../../server/_lib/lottery/amoeReplayStore.js', () => ({
  insertPending: insertPendingMock,
  markProven: markProvenMock,
  markBroadcasting: markBroadcastingMock,
  markSettled: markSettledMock,
  markManagerDeclined: markManagerDeclinedMock,
  markRejectedChain: markRejectedChainMock,
  markProveFailed: markProveFailedMock,
  findActiveByNonceCommit: findActiveByNonceCommitMock,
}))

vi.mock('../../server/_lib/onchain/contracts.js', () => ({
  getApiContracts: () => ({
    lotteryManager: '0x77705a2f173dd52f28300447506dc35086c34626',
  }),
}))

// `parseAmoeEntryMessage` mirrors the production parser (see
// `lotteryAmoe.ts`); we keep an inline copy here so the handler test
// stays a hermetic unit. If the production format changes, update this
// fixture builder + the parser-imported behavior together.
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
    `Creator Coin: ${fields.creatorCoin}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expires At: ${fields.expiresAt}`,
    `Chain ID: ${fields.chainId}`,
    `Lottery Manager: ${fields.lotteryManager}`,
  ].join('\n')
}

// We deliberately avoid `vi.importActual('lotteryAmoe.js')` here: that
// module pulls in viem / DB / contract helpers, which we want to keep
// out of this hermetic handler test. Instead, we provide a faithful
// inline re-implementation of `parseAmoeEntryMessage`, hoisted so the
// `vi.mock` factory below can reference it. If the production grammar
// changes, update both this fixture parser and `buildTestEntryMessage`
// above (PR 4 will lock the format behind a shared canonical builder).
const { parseTestEntryMessage } = vi.hoisted(() => {
  function parseTestEntryMessage(message: string): {
    wallet: `0x${string}`
    creatorCoin: `0x${string}`
    nonce: `0x${string}`
    issuedAt: string
    expiresAt: string
    chainId: number
    lotteryManager: `0x${string}`
  } | null {
    if (typeof message !== 'string' || message.trim().length === 0) return null
    const lines = message.split('\n').map((line) => line.trim())
    if (lines[0] !== 'Perplexity AMOE Entry') return null
    const readField = (prefix: string): string | null => {
      const line = lines.find((l) => l.toLowerCase().startsWith(prefix.toLowerCase()))
      if (!line) return null
      const raw = line.slice(prefix.length).trim()
      return raw.length > 0 ? raw : null
    }
    const wallet = readField('Wallet:')
    const creatorCoin = readField('Creator Coin:')
    const nonce = readField('Nonce:')
    const issuedAt = readField('Issued At:')
    const expiresAt = readField('Expires At:')
    const chainIdRaw = readField('Chain ID:')
    const lotteryManager = readField('Lottery Manager:')
    if (!wallet || !creatorCoin || !nonce || !issuedAt || !expiresAt || !chainIdRaw || !lotteryManager) return null
    const isAddr = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v)
    const isB32 = (v: string) => /^0x[a-fA-F0-9]{64}$/.test(v)
    if (!isAddr(wallet) || !isAddr(creatorCoin) || !isAddr(lotteryManager)) return null
    if (!isB32(nonce)) return null
    const chainId = Number(chainIdRaw)
    if (!Number.isFinite(chainId)) return null
    return {
      wallet: wallet.toLowerCase() as `0x${string}`,
      creatorCoin: creatorCoin.toLowerCase() as `0x${string}`,
      nonce: nonce.toLowerCase() as `0x${string}`,
      issuedAt,
      expiresAt,
      chainId: Math.floor(chainId),
      lotteryManager: lotteryManager.toLowerCase() as `0x${string}`,
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
  // PR 4 — the handler now also reads pubInputs by slot to compute
  // commitment hexes for the replay-store row.
  AMOE_PLONK_PUB_INPUT_SLOT: {
    walletAddrCommit: 0,
    creatorCoinAddr: 1,
    nonceCommit: 2,
    epoch: 3,
    allowlistRoot: 4,
    pointsBurnedAsUSD: 5,
    pointsLedgerRoot: 6,
    pointsBurnNullifier: 7,
  },
}))

import {
  __resetAmoeSubmitZkHandlerHooksForTest,
  __setAmoeSubmitZkHandlerHooksForTest,
} from '../_handlers/v1/lottery/_amoeSubmitZk.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'
import {
  AmoeAuthorityError,
  AmoeBadRequestError,
  AmoeInsufficientCreditsError,
} from '../../server/_lib/lottery/lotteryAmoeErrors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_CREATOR = '0x0000000000000000000000000000000000001001'
const VALID_NONCE = `0x${'ab'.repeat(32)}`
const VALID_SIG = `0x${'cd'.repeat(65)}`
const CANONICAL_WALLET = '0x000000000000000000000000000000000000cafe'
const LOTTERY_MANAGER = '0x77705a2f173dd52f28300447506dc35086c34626' // matches getApiContracts mock
const PROFILE_ID = 42
const FIXTURE_TX = `0x${'ee'.repeat(32)}`

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
  const prior = process.env.AMOE_ZK_SUBMIT_ENABLED
  const priorRouter = process.env.LOTTERY_AMOE_ROUTER
  process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
  process.env.LOTTERY_AMOE_ROUTER = '0x000000000000000000000000000000000000abcd'
  return () => {
    if (prior === undefined) delete process.env.AMOE_ZK_SUBMIT_ENABLED
    else process.env.AMOE_ZK_SUBMIT_ENABLED = prior
    if (priorRouter === undefined) delete process.env.LOTTERY_AMOE_ROUTER
    else process.env.LOTTERY_AMOE_ROUTER = priorRouter
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
  consumeAmoeNonceForSubmitMock.mockResolvedValue(undefined)
  getAmoeCreditSnapshotMock.mockResolvedValue({
    wallet: CANONICAL_WALLET,
    credits: 1000,
    creditsPerEntry: 100,
    entriesAvailable: 10,
    nextEntryAtCredits: 100,
  })
  consumeAmoeCreditsForEntryMock.mockResolvedValue({
    consumed: 250,
    creditsRemaining: 750,
    creditsPerEntry: 100,
    entriesAvailable: 7,
  })

  // PR 4 — replay-store happy-path defaults. Tests that exercise
  // failure branches (markProven unique-violation, markManagerDeclined,
  // etc.) override these with mockRejectedValueOnce / mockReturnValueOnce.
  insertPendingMock.mockResolvedValue('00000000-0000-0000-0000-000000000000')
  markProvenMock.mockImplementation(async (id: string) => ({
    id,
    state: 'proven',
    retryCount: 0,
  }))
  markBroadcastingMock.mockImplementation(async (id: string) => ({
    id,
    state: 'broadcast',
    retryCount: 0,
  }))
  markSettledMock.mockImplementation(async (id: string) => ({
    id,
    state: 'settled',
    retryCount: 0,
  }))
  markManagerDeclinedMock.mockImplementation(async (id: string) => ({
    id,
    state: 'manager_declined',
    retryCount: 1,
  }))
  markRejectedChainMock.mockImplementation(async (id: string) => ({
    id,
    state: 'rejected_chain',
  }))
  markProveFailedMock.mockImplementation(async (id: string) => ({
    id,
    state: 'prove_failed',
  }))
  findActiveByNonceCommitMock.mockResolvedValue(null)
})

afterEach(() => {
  __resetAmoeSubmitZkHandlerHooksForTest()
})

// ---------------------------------------------------------------------------
// Routing + method
// ---------------------------------------------------------------------------

describe('routing — lottery/amoe/submit-zk', () => {
  it('registers the submit-zk route', async () => {
    const fn = await getV1ApiHandler('lottery/amoe/submit-zk')
    expect(typeof fn).toBe('function')
  })
})

describe('method enforcement', () => {
  it('returns 405 for non-POST', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(405)
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

describe('feature flag', () => {
  it('returns 503 zk_path_disabled when AMOE_ZK_SUBMIT_ENABLED is unset', async () => {
    delete process.env.AMOE_ZK_SUBMIT_ENABLED
    const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
    const req = createMockReq({ method: 'POST', body: validBody() })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('zk_path_disabled')
  })

  it('returns 503 zk_path_disabled when flag value is not literal "1"', async () => {
    process.env.AMOE_ZK_SUBMIT_ENABLED = 'true'
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body?.error).toBe('zk_path_disabled')
    } finally {
      delete process.env.AMOE_ZK_SUBMIT_ENABLED
    }
  })
})

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

describe('body validation', () => {
  it('rejects bad creatorCoin', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ creatorCoin: '0x123' }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toMatch(/creatorCoin|signature|nonce/)
    } finally {
      restore()
    }
  })

  it('rejects empty message', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ message: '' }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
    } finally {
      restore()
    }
  })

  it('rejects bad signature (no 0x)', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ signature: 'deadbeef' }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
    } finally {
      restore()
    }
  })

  it('rejects bad nonce length', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ nonce: '0xdead' }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
    } finally {
      restore()
    }
  })

  it('rejects empty twitterHandle', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ twitterHandle: '   ' }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toMatch(/twitterHandle|spendRefId/)
    } finally {
      restore()
    }
  })

  it('rejects empty spendRefId', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ spendRefId: '' }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
    } finally {
      restore()
    }
  })

  it('rejects pointsBurned below minimum', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ pointsBurned: 50 }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toMatch(/pointsBurned/)
    } finally {
      restore()
    }
  })

  it('rejects pointsBurned above maximum', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ pointsBurned: 2_000_000 }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
    } finally {
      restore()
    }
  })

  it('rejects non-integer pointsBurned', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ pointsBurned: 250.5 }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Configuration & environment
// ---------------------------------------------------------------------------

describe('configuration', () => {
  it('returns 503 when LOTTERY_AMOE_ROUTER is unset', async () => {
    process.env.AMOE_ZK_SUBMIT_ENABLED = '1'
    delete process.env.LOTTERY_AMOE_ROUTER
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body?.error).toMatch(/Lottery manager/i)
    } finally {
      delete process.env.AMOE_ZK_SUBMIT_ENABLED
    }
  })
})

// ---------------------------------------------------------------------------
// Auth + profile resolution
// ---------------------------------------------------------------------------

describe('auth and profile resolution', () => {
  it('returns auth-mismatch error when resolveAmoeWallet fails', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: false,
        error: 'wallet_authority_mismatch',
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      // classifyAmoeError maps AmoeAuthorityError → 403.
      expect(res.statusCode).toBe(403)
    } finally {
      restore()
    }
  })

  it('returns 403 amoe_profile_unresolved when profileId is null', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: true,
        value: {
          wallet: CANONICAL_WALLET,
          profileId: null,
          canonicalSmartWalletAddress: CANONICAL_WALLET,
          activeOwnerWalletAddress: null,
        },
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })

  it('returns 403 amoe_profile_unresolved when profileId is 0', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: true,
        value: {
          wallet: CANONICAL_WALLET,
          profileId: 0,
          canonicalSmartWalletAddress: CANONICAL_WALLET,
          activeOwnerWalletAddress: null,
        },
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })

  // Codex review #439: a JS `number` profileId above
  // `Number.MAX_SAFE_INTEGER` would silently alias distinct Postgres
  // bigint rows to the same JS number, producing collisions in
  // `signupIdHash`. Reject explicitly.
  it('returns 403 amoe_profile_unresolved when profileId exceeds MAX_SAFE_INTEGER', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: true,
        value: {
          wallet: CANONICAL_WALLET,
          // 2^53 — first integer that JS `number` cannot represent
          // exactly. The resolver type is `number`, so this is the
          // realistic upper boundary.
          profileId: Number.MAX_SAFE_INTEGER + 1,
          canonicalSmartWalletAddress: CANONICAL_WALLET,
          activeOwnerWalletAddress: null,
        },
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })

  it('returns 403 amoe_profile_unresolved when profileId is non-finite (NaN)', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: true,
        value: {
          wallet: CANONICAL_WALLET,
          profileId: Number.NaN,
          canonicalSmartWalletAddress: CANONICAL_WALLET,
          activeOwnerWalletAddress: null,
        },
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
      expect(res.body?.error).toBe('amoe_profile_unresolved')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Message binding (Codex review #439)
//
// The EIP-191 message must parse and bind to (wallet, creatorCoin,
// nonce, chainId, lotteryManager, expiresAt). Any mismatch must reject
// BEFORE the signature is verified, so a leaked/old wallet signature
// over any string from the same wallet cannot be replayed with a fresh
// nonce.
// ---------------------------------------------------------------------------

describe('message binding', () => {
  it('rejects unparseable message with invalid_message', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({ message: 'this-is-not-the-canonical-format' }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('invalid_message')
    } finally {
      restore()
    }
  })

  it('rejects message bound to a different wallet (wallet_mismatch)', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({
            wallet: '0x0000000000000000000000000000000000001234' as `0x${string}`,
          }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('wallet_mismatch')
    } finally {
      restore()
    }
  })

  it('rejects message bound to a different creator coin (creator_mismatch)', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({
            creatorCoin: '0x0000000000000000000000000000000000005678' as `0x${string}`,
          }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('creator_mismatch')
    } finally {
      restore()
    }
  })

  it('rejects message bound to a different nonce (nonce_mismatch) — prevents signature replay across nonces', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const otherNonce = `0x${'99'.repeat(32)}` as `0x${string}`
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({ nonce: otherNonce }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('nonce_mismatch')
    } finally {
      restore()
    }
  })

  it('rejects message with non-Base chain id (invalid_chain)', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({ chainId: 1 }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('invalid_chain')
    } finally {
      restore()
    }
  })

  it('rejects message bound to wrong lottery manager (lottery_manager_mismatch)', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({
            lotteryManager: '0x000000000000000000000000000000000000dead' as `0x${string}`,
          }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('lottery_manager_mismatch')
    } finally {
      restore()
    }
  })

  it('rejects expired message (message_expired) — prevents stale signature replay', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
          }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('message_expired')
    } finally {
      restore()
    }
  })

  // Fix #1 (mirrored from PR #457 review): `Date.parse('not-a-date')`
  // is NaN, and `NaN <= Date.now()` is false. Without an explicit
  // `Number.isFinite` check, a malformed `expiresAt` would slip past
  // the expiry guard and weaken the replay-window contract for any
  // signed payload with a non-ISO timestamp. Same fix lives in
  // `_amoeBurnCredits.ts` (the bug is identical because that handler
  // was extracted from this one).
  it('rejects non-parseable expiresAt as message_expired (Fix #1)', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({ expiresAt: 'not-a-date' }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('message_expired')
    } finally {
      restore()
    }
  })

  // Order matters: message-binding errors must surface BEFORE signature
  // verification, otherwise a leaked sig over an unbound message could
  // mask the real issue and give an attacker an oracle.
  it('does NOT call verifyAmoeWalletSignature when message binding fails', async () => {
    const restore = setEnabledEnv()
    try {
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({
        method: 'POST',
        body: validBody({
          message: buildValidMessage({
            creatorCoin: '0x0000000000000000000000000000000000005678' as `0x${string}`,
          }),
        }),
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.body?.error).toBe('creator_mismatch')
      expect(verifyAmoeWalletSignatureMock).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('signature verification', () => {
  it('returns 400 signature_invalid when verify returns false', async () => {
    const restore = setEnabledEnv()
    try {
      verifyAmoeWalletSignatureMock.mockResolvedValueOnce(false)
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('signature_invalid')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Nonce reuse / replay
// ---------------------------------------------------------------------------

describe('nonce reuse', () => {
  it('returns 400-class nonce_already_used when nonce store rejects', async () => {
    const restore = setEnabledEnv()
    try {
      consumeAmoeNonceForSubmitMock.mockRejectedValueOnce(
        new AmoeBadRequestError('nonce_already_used'),
      )
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      // AmoeBadRequestError defaults to 400 in classifyAmoeError.
      expect(res.statusCode).toBe(400)
      expect(res.body?.error).toBe('nonce_already_used')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Insufficient credits
// ---------------------------------------------------------------------------

describe('credit gate', () => {
  it('returns 402 insufficient_amoe_credits when snapshot.credits < pointsBurned', async () => {
    const restore = setEnabledEnv()
    try {
      getAmoeCreditSnapshotMock.mockResolvedValueOnce({
        wallet: CANONICAL_WALLET,
        credits: 100, // less than pointsBurned=250
        creditsPerEntry: 100,
        entriesAvailable: 1,
        nextEntryAtCredits: 100,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(402)
      expect(res.body?.error).toBe('insufficient_amoe_credits')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Happy path with injected hooks
// ---------------------------------------------------------------------------

describe('happy path', () => {
  it('returns 200 with proofMode=plonk on a successful submission', async () => {
    const restore = setEnabledEnv()
    try {
      const orchestrate = vi.fn(async () => ({
        call: {
          to: '0x000000000000000000000000000000000000abcd' as `0x${string}`,
          callData: '0xdeadbeef' as `0x${string}`,
          pointsBurnedAsUSD: '250000000',
          estimatedWinChancePPM: 1000,
        },
        proof: {
          proof: Array.from({ length: 24 }, () => 1n),
          pubInputs: Array.from({ length: 8 }, () => 1n),
        },
        epoch: 7n,
        pointsBurnedAsUSD: 250_000_000n,
        // PR 5b: orchestrator now returns the derived twitter-credit
        // nullifier so the handler can persist it on the markProven row.
        twitterCreditNullifier: 0xdeadbeefcafe1234567890abcdefn,
      }))
      const relay = vi.fn(async () => FIXTURE_TX as `0x${string}`)

      __setAmoeSubmitZkHandlerHooksForTest({
        orchestrate: orchestrate as any,
        relay: relay as any,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.proofMode).toBe('plonk')
      expect(res.body?.data?.epoch).toBe('7')
      expect(res.body?.data?.txHash).toBe(FIXTURE_TX)
      expect(res.body?.data?.pointsBurned).toBe(250)
      expect(res.body?.data?.pointsBurnedAsUSD).toBe('250000000')
      expect(res.body?.data?.creditsConsumed).toBe(250)
      expect(res.body?.data?.creditsRemaining).toBe(750)

      // Orchestrate was called with the lowercased creator coin and the
      // canonical wallet from the resolver.
      expect(orchestrate).toHaveBeenCalledTimes(1)
      const call = (orchestrate.mock.calls[0] as unknown[])[0] as Record<string, unknown>
      expect(call.wallet).toBe(CANONICAL_WALLET)
      expect(call.creatorCoin).toBe(VALID_CREATOR.toLowerCase())
      expect(call.profileId).toBe(BigInt(PROFILE_ID))
      expect(call.twitterHandle).toBe('wenakita')
      expect(call.spendRefId).toBe('idem-2026-04-29-aaaa')

      // Relay was called with the calldata from orchestration.
      expect(relay).toHaveBeenCalledWith({
        to: '0x000000000000000000000000000000000000abcd',
        callData: '0xdeadbeef',
      })

      // Credit debit was issued AFTER relay (we can't check ordering with
      // bare mocks, but we can at least check both were called).
      expect(consumeAmoeCreditsForEntryMock).toHaveBeenCalledTimes(1)
      const debitArg = consumeAmoeCreditsForEntryMock.mock.calls[0]?.[0]
      // PR 5b correctness fix — refId is now the original client-supplied
      // `spendRefId`, NOT `zk:${submissionId}`. This is required so that
      // `points.source_id == amoe_zk_submissions.spend_ref_id` and the
      // publisher's `defaultLookupBurnContext` join succeeds. Mismatch
      // would cause the projector to skip the burn and the publisher to
      // emit a partial root (Codex review on PR 5b).
      expect(debitArg).toMatchObject({
        wallet: CANONICAL_WALLET,
        requiredCredits: 250,
        refId: 'idem-2026-04-29-aaaa',
      })
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Proof generation errors → 422
// ---------------------------------------------------------------------------

describe('AmoeProofGenerationError mapping', () => {
  it('maps AmoeProofGenerationError to 422 with the typed code', async () => {
    const restore = setEnabledEnv()
    try {
      // We construct an error with the same name + code shape that the
      // handler is supposed to detect. Avoids depending on the real
      // AmoeProofGenerationError import, which is mocked in places.
      class FakeProofErr extends Error {
        public override readonly name = 'AmoeProofGenerationError'
        public readonly code: string
        constructor(code: string) {
          super(code)
          this.code = code
        }
      }
      const orchestrate = vi.fn(async () => {
        throw new FakeProofErr('plonk_witness_input_invalid')
      })
      __setAmoeSubmitZkHandlerHooksForTest({
        orchestrate: orchestrate as any,
        relay: vi.fn() as any,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(422)
      expect(res.body?.error).toBe('plonk_witness_input_invalid')
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Generic AMOE error mapping
// ---------------------------------------------------------------------------

describe('AmoeAuthorityError mapping (resolver returns ok:false)', () => {
  it('classifies authority error as 403', async () => {
    const restore = setEnabledEnv()
    try {
      resolveAmoeWalletMock.mockResolvedValueOnce({
        ok: false,
        error: 'wallet_authority_mismatch',
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(403)
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('rate limiting', () => {
  it('returns 429 when in-process rate limit denies', async () => {
    const restore = setEnabledEnv()
    try {
      checkRateLimitMock.mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
    } finally {
      restore()
    }
  })

  it('returns 429 when durable rate limit denies', async () => {
    const restore = setEnabledEnv()
    try {
      checkDurableRateLimitMock.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      })
      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(429)
    } finally {
      restore()
    }
  })
})

// ---------------------------------------------------------------------------
// PR 6b — burn-then-submit phase B (AMOE_BURN_THEN_SUBMIT_REQUIRED=1)
// ---------------------------------------------------------------------------
//
// Behavior under flag-on:
//   * Skips `getAmoeCreditSnapshot` pre-flight (phase A is authoritative).
//   * Pre-flights `readSnapshotForBurn` BEFORE `insertPending` and maps:
//       — `AmoeBurnRowMissingError`           → 409 `amoe_burn_not_found`
//       — `AmoeSnapshotNotYetConfirmedError`  → 425 `amoe_snapshot_not_yet_confirmed`
//                                                with `Retry-After` header
//                                                + `eligibleSubmitAfterUnixSec` body
//       — db missing                          → 503 `amoe_ledger_snapshot_unavailable`
//   * Skips trailing `consumeAmoeCreditsForEntry` (phase A debited).
//     Re-fetches `getAmoeCreditSnapshot` post-relay so the response
//     payload still carries `creditsRemaining`/`creditsPerEntry`/
//     `entriesAvailable`; `creditsConsumed` is 0 (this handler did not
//     consume — phase A returned the consumption count to the client).

function setBurnThenSubmitEnv(): () => void {
  const prior = process.env.AMOE_BURN_THEN_SUBMIT_REQUIRED
  process.env.AMOE_BURN_THEN_SUBMIT_REQUIRED = '1'
  return () => {
    if (prior === undefined) delete process.env.AMOE_BURN_THEN_SUBMIT_REQUIRED
    else process.env.AMOE_BURN_THEN_SUBMIT_REQUIRED = prior
  }
}

describe('PR 6b — burn-then-submit pre-flight reader', () => {
  it('returns 409 amoe_burn_not_found when reader throws AmoeBurnRowMissingError', async () => {
    const restoreSubmit = setEnabledEnv()
    const restoreBurnFlag = setBurnThenSubmitEnv()
    try {
      const { AmoeBurnRowMissingError } = await import(
        '../../server/_lib/lottery/amoeLedgerSnapshotReader'
      )
      const readSnapshotForBurn = vi.fn(
        async (_args: { signupId: bigint; spendRefId: string }) => {
          throw new AmoeBurnRowMissingError()
        },
      )
      __setAmoeSubmitZkHandlerHooksForTest({
        ledgerSnapshotReader: { readSnapshotForBurn } as any,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(409)
      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('amoe_burn_not_found')
      expect(typeof res.body?.hint).toBe('string')
      // The pre-flight runs BEFORE `insertPending` and BEFORE the trailing
      // debit, so neither should fire on this error.
      expect(insertPendingMock).not.toHaveBeenCalled()
      expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
      // Reader was called with the parsed signupId (from profileId mock
      // = PROFILE_ID = 42) and the body's spendRefId.
      expect(readSnapshotForBurn).toHaveBeenCalledTimes(1)
      expect(readSnapshotForBurn.mock.calls[0]?.[0]).toEqual({
        signupId: BigInt(PROFILE_ID),
        spendRefId: 'idem-2026-04-29-aaaa',
      })
    } finally {
      restoreBurnFlag()
      restoreSubmit()
    }
  })

  it('returns 425 amoe_snapshot_not_yet_confirmed with Retry-After when reader throws AmoeSnapshotNotYetConfirmedError', async () => {
    const restoreSubmit = setEnabledEnv()
    const restoreBurnFlag = setBurnThenSubmitEnv()
    try {
      const { AmoeSnapshotNotYetConfirmedError } = await import(
        '../../server/_lib/lottery/amoeLedgerSnapshotReader'
      )
      const readSnapshotForBurn = vi.fn(
        async (_args: { signupId: bigint; spendRefId: string }) => {
          throw new AmoeSnapshotNotYetConfirmedError()
        },
      )
      __setAmoeSubmitZkHandlerHooksForTest({
        ledgerSnapshotReader: { readSnapshotForBurn } as any,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(425)
      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('amoe_snapshot_not_yet_confirmed')
      expect(typeof res.body?.eligibleSubmitAfterUnixSec).toBe('number')
      // `Retry-After` is set in seconds and is at least 60 (handler
      // floors at one minute even if the boundary is closer). The
      // mock res normalizes header names to lowercase.
      const retryAfter = res.getHeader('Retry-After')
      expect(typeof retryAfter).toBe('string')
      expect(Number(retryAfter)).toBeGreaterThanOrEqual(60)
      expect(insertPendingMock).not.toHaveBeenCalled()
      expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
    } finally {
      restoreBurnFlag()
      restoreSubmit()
    }
  })

  it('returns 503 amoe_ledger_snapshot_unavailable when no reader injected and DB is unconfigured', async () => {
    const restoreSubmit = setEnabledEnv()
    const restoreBurnFlag = setBurnThenSubmitEnv()
    // Defensive: ensure no Postgres URL is leaking from CI env so
    // `getDb()` resolves to null and the handler hits the 503 branch.
    // (We clear legacy Vercel Postgres vars too; Supabase is the canonical DB.)
    const priorDbUrl = process.env.DATABASE_URL
    const priorPgUrl = process.env.POSTGRES_URL
    const priorPgUrlNp = process.env.POSTGRES_URL_NON_POOLING
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_URL
    delete process.env.POSTGRES_URL_NON_POOLING
    try {
      // No `ledgerSnapshotReader` injection — forces the handler to
      // fall through to the `getDb()` branch.
      __setAmoeSubmitZkHandlerHooksForTest({})

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(res.body?.success).toBe(false)
      expect(res.body?.error).toBe('amoe_ledger_snapshot_unavailable')
      expect(insertPendingMock).not.toHaveBeenCalled()
      expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
    } finally {
      if (priorDbUrl !== undefined) process.env.DATABASE_URL = priorDbUrl
      if (priorPgUrl !== undefined) process.env.POSTGRES_URL = priorPgUrl
      if (priorPgUrlNp !== undefined) process.env.POSTGRES_URL_NON_POOLING = priorPgUrlNp
      restoreBurnFlag()
      restoreSubmit()
    }
  })
})

describe('PR 6b — burn-then-submit happy path', () => {
  it('returns 200 without calling consumeAmoeCreditsForEntry; re-fetches credit snapshot for response shape', async () => {
    const restoreSubmit = setEnabledEnv()
    const restoreBurnFlag = setBurnThenSubmitEnv()
    try {
      // Reader resolves — burn row exists and snapshot is confirmed.
      // Return shape mirrors the orchestrator's expectations; the
      // handler itself only awaits the call (it doesn't introspect the
      // result), so the body can stay minimal.
      const readSnapshotForBurn = vi.fn(
        async (_args: { signupId: bigint; spendRefId: string }) => ({
          burn: {
            signupId: BigInt(PROFILE_ID),
            spendRefId: 'idem-2026-04-29-aaaa',
            burnedAt: '2026-04-29T00:00:00.000Z',
            burnEpoch: 7,
            amount: 250,
          },
        }),
      )
      const orchestrate = vi.fn(async () => ({
        call: {
          to: '0x000000000000000000000000000000000000abcd' as `0x${string}`,
          callData: '0xdeadbeef' as `0x${string}`,
          pointsBurnedAsUSD: '250000000',
          estimatedWinChancePPM: 1000,
        },
        proof: {
          proof: Array.from({ length: 24 }, () => 1n),
          pubInputs: Array.from({ length: 8 }, () => 1n),
        },
        epoch: 7n,
        pointsBurnedAsUSD: 250_000_000n,
        twitterCreditNullifier: 0xdeadbeefcafe1234567890abcdefn,
      }))
      const relay = vi.fn(async () => FIXTURE_TX as `0x${string}`)

      // The post-relay balance read replaces the trailing debit's
      // payload contribution. Returns the wallet's current credit
      // state — the burn already happened in phase A so credits are
      // already debited; the snapshot reflects the post-burn balance.
      getAmoeCreditSnapshotMock.mockResolvedValueOnce({
        wallet: CANONICAL_WALLET,
        credits: 750,
        creditsPerEntry: 100,
        entriesAvailable: 7,
        nextEntryAtCredits: 800,
      })

      __setAmoeSubmitZkHandlerHooksForTest({
        orchestrate: orchestrate as any,
        relay: relay as any,
        ledgerSnapshotReader: { readSnapshotForBurn } as any,
      })

      const { default: handler } = await import('../_handlers/v1/lottery/_amoeSubmitZk')
      const req = createMockReq({ method: 'POST', body: validBody() })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.proofMode).toBe('plonk')
      expect(res.body?.data?.txHash).toBe(FIXTURE_TX)
      expect(res.body?.data?.pointsBurned).toBe(250)
      // Phase B no longer consumes — `creditsConsumed` is 0.
      expect(res.body?.data?.creditsConsumed).toBe(0)
      // Balance fields populated from the post-relay snapshot read.
      expect(res.body?.data?.creditsRemaining).toBe(750)
      expect(res.body?.data?.creditsPerEntry).toBe(100)
      expect(res.body?.data?.entriesAvailable).toBe(7)

      // Critical invariant for PR 6b: trailing debit is gated OFF.
      // Phase A already wrote the burn row; calling it again here
      // would either no-op (idempotent) or double-debit under a
      // mismatched refId. Either way: not allowed.
      expect(consumeAmoeCreditsForEntryMock).not.toHaveBeenCalled()
      // Pre-flight reader was called once.
      expect(readSnapshotForBurn).toHaveBeenCalledTimes(1)
      // Orchestrator was called and the reader was passed through.
      expect(orchestrate).toHaveBeenCalledTimes(1)
      const orchestrateOpts = (orchestrate.mock.calls[0] as unknown[])[1] as Record<
        string,
        unknown
      >
      expect(orchestrateOpts.ledgerSnapshotReader).toBeDefined()
    } finally {
      restoreBurnFlag()
      restoreSubmit()
    }
  })
})
