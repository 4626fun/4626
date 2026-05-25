/**
 * Tests for the waitlist Base App register endpoint
 * (POST /api/arch-b/sub-account/baseapp/register).
 *
 * Mirrors the mock layout of `subAccountProvision.test.ts` but the
 * write path is much smaller — no SpendPermission verification, no
 * Privy delegation gate, no on-chain bytecode probe gating the result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from '../helpers'

// ---------------------------------------------------------------------------
// Hoisted mocks (server-core boundary)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const bag = {
    handleOptions: vi.fn(() => false),
    setCors: vi.fn(),
    setNoStore: vi.fn(),
    readBoundedJsonObjectBody: vi.fn(async () => ({})),
    getDb: vi.fn(),
    isDbConfigured: vi.fn(() => true),
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  resolveAuthorizedRequestPrincipal: vi.fn(),
  // We don't use the on-chain sanity read in tests — the handler test
  // seam (`__setHandlerHooksForTest`) injects a no-op so it never tries
  // to reach Base RPC.
    getBasePublicClient: vi.fn(() => ({})),
    runInTransaction: vi.fn(async (fn: (db: unknown) => Promise<unknown>) => {
      const db = await bag.getDb()
      if (!db) return null
      return fn(db)
    }),
  }
  return bag
})

vi.mock('../../../packages/server-core/src/index.js', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  readBoundedJsonObjectBody: mocks.readBoundedJsonObjectBody,
  getDb: mocks.getDb,
  runInTransaction: mocks.runInTransaction,
  isDbConfigured: mocks.isDbConfigured,
  getClientIp: mocks.getClientIp,
  checkRateLimit: mocks.checkRateLimit,
  rateLimitKey: mocks.rateLimitKey,
  resolveAuthorizedRequestPrincipal: mocks.resolveAuthorizedRequestPrincipal,
  RATE_LIMITS: { adminAction: { windowMs: 60_000, maxRequests: 30 } },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('../../../server/_lib/wallet/subAccountProvisionVerify.js', () => ({
  getBasePublicClient: mocks.getBasePublicClient,
}))

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = 42
const PARENT_CSW = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SUB_ACCOUNT = '0xcccccccccccccccccccccccccccccccccccccccc'
const EMBEDDED_EOA = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const OTHER_EOA = '0x9999999999999999999999999999999999999999'
const OTHER_PARENT = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const PRINCIPAL_ADDRESS = '0xdddddddddddddddddddddddddddddddddddddddd'

const AUTHORIZED_PRINCIPAL = {
  address: PRINCIPAL_ADDRESS,
  source: 'session' as const,
  authSource: 'session' as const,
  profileId: PROFILE_ID,
  canonicalSmartWalletAddress: PARENT_CSW,
  activeOwnerWalletAddress: EMBEDDED_EOA,
  signerRole: 'active_owner_wallet' as const,
}

/**
 * Build a fake `db` object that records every SQL invocation. The test
 * matcher inspects the captured SQL fragments to assert which UPDATE /
 * INSERT statements ran.
 *
 * `responses` is a sequence of `{ rows }` shapes, consumed in order
 * for `SELECT` calls (via the `selectResponses` queue). Statements that
 * don't return rows resolve to `{ rows: [] }`.
 */
function makeFakeDb(opts: {
  selectResponses?: Array<{ rows: Array<Record<string, unknown>> }>
  failOn?: { match: string; error: Error }
} = {}) {
  const calls: Array<{ sql: string; values: unknown[] }> = []
  const selectQueue = [...(opts.selectResponses ?? [])]
  return {
    calls,
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = Array.isArray(strings) ? strings.join('?') : String(strings)
      calls.push({ sql, values })
      if (opts.failOn && sql.includes(opts.failOn.match)) {
        throw opts.failOn.error
      }
      const upper = sql.trimStart().toUpperCase()
      if (upper.startsWith('SELECT')) {
        return selectQueue.shift() ?? { rows: [] }
      }
      // BEGIN / COMMIT / ROLLBACK / INSERT / UPDATE
      return { rows: [] }
    }),
  }
}

function profilesSelectResponse(embeddedEoa: string | null) {
  return { rows: embeddedEoa === null ? [] : [{ primary_embedded_eoa: embeddedEoa }] }
}

function ciecSelectResponse(parentCsw: string | null) {
  return { rows: parentCsw === null ? [] : [{ parent_csw_address: parentCsw }] }
}

const SANITY_NOOP = vi.fn(async () => undefined)

function defaultBody() {
  return {
    parentAddress: PARENT_CSW,
    subAccountAddress: SUB_ACCOUNT,
    embeddedEoaAddress: EMBEDDED_EOA,
  }
}

function resetMocks() {
  vi.clearAllMocks()
  process.env.WAITLIST_SUBACCOUNT_FLOW_ENABLED = '1'

  mocks.handleOptions.mockReturnValue(false)
  mocks.isDbConfigured.mockReturnValue(true)
  mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 })
  mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(AUTHORIZED_PRINCIPAL)
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('POST /api/arch-b/sub-account/baseapp/register', () => {
  let handler: (typeof import('../../_handlers/arch-b/_subAccountBaseAppRegister.js'))['default']
  let setHooks: (typeof import('../../_handlers/arch-b/_subAccountBaseAppRegister.js'))['__setHandlerHooksForTest']
  let resetHooks: (typeof import('../../_handlers/arch-b/_subAccountBaseAppRegister.js'))['__resetHandlerHooksForTest']

  beforeEach(async () => {
    resetMocks()
    const mod = await import('../../_handlers/arch-b/_subAccountBaseAppRegister.ts')
    handler = mod.default
    setHooks = mod.__setHandlerHooksForTest
    resetHooks = mod.__resetHandlerHooksForTest
    setHooks({ sanityReadSubAccount: SANITY_NOOP })
    SANITY_NOOP.mockClear()
    mocks.readBoundedJsonObjectBody.mockResolvedValue(defaultBody())
  })

  // -------------------------- Feature flag --------------------------

  it('returns 503 feature_disabled when WAITLIST_SUBACCOUNT_FLOW_ENABLED is unset', async () => {
    delete process.env.WAITLIST_SUBACCOUNT_FLOW_ENABLED
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('feature_disabled')
  })

  it('returns 503 feature_disabled when flag is set to a non-1 value', async () => {
    process.env.WAITLIST_SUBACCOUNT_FLOW_ENABLED = 'true'
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('feature_disabled')
    resetHooks()
  })

  // -------------------------- Method gate --------------------------

  it('returns 405 for non-POST', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  // -------------------------- Auth --------------------------

  it('returns 401 unauthenticated when principal is null', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue(null)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('unauthenticated')
  })

  it('returns 409 profile_not_ready when principal lacks profileId', async () => {
    mocks.resolveAuthorizedRequestPrincipal.mockResolvedValue({
      ...AUTHORIZED_PRINCIPAL,
      profileId: null,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('profile_not_ready')
  })

  // -------------------------- Body validation --------------------------

  it('returns 400 invalid_body when body is null', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue(null as unknown as Record<string, unknown>)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_body')
  })

  it('returns 400 invalid_address when parentAddress is malformed', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      ...defaultBody(),
      parentAddress: 'not-an-address',
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_address')
  })

  it('returns 400 invalid_address when subAccountAddress is missing', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      parentAddress: PARENT_CSW,
      embeddedEoaAddress: EMBEDDED_EOA,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_address')
  })

  it('returns 400 invalid_address when embeddedEoaAddress is too short', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      ...defaultBody(),
      embeddedEoaAddress: '0xabc',
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_address')
  })

  it('returns 400 sub_account_not_distinct when sub-account equals parent CSW', async () => {
    mocks.readBoundedJsonObjectBody.mockResolvedValue({
      ...defaultBody(),
      subAccountAddress: PARENT_CSW,
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('sub_account_not_distinct')
  })

  // -------------------------- DB availability --------------------------

  it('returns 503 db_unavailable when db is not configured', async () => {
    mocks.isDbConfigured.mockReturnValue(false)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('db_unavailable')
  })

  it('returns 503 db_unavailable when getDb resolves to null', async () => {
    mocks.getDb.mockResolvedValue(null)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('db_unavailable')
  })

  // -------------------------- embedded EOA mismatch --------------------------

  it('returns 400 embedded_eoa_mismatch when profile has no recorded embedded EOA', async () => {
    const db = makeFakeDb({
      selectResponses: [profilesSelectResponse(null)],
    })
    mocks.getDb.mockResolvedValue(db)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('embedded_eoa_mismatch')
  })

  it('returns 400 embedded_eoa_mismatch when profile EOA differs from body', async () => {
    const db = makeFakeDb({
      selectResponses: [profilesSelectResponse(OTHER_EOA)],
    })
    mocks.getDb.mockResolvedValue(db)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('embedded_eoa_mismatch')
  })

  // -------------------------- parent CSW conflict --------------------------

  it('returns 409 parent_csw_conflict when prior row binds a different parent', async () => {
    const db = makeFakeDb({
      selectResponses: [
        profilesSelectResponse(EMBEDDED_EOA),
        ciecSelectResponse(OTHER_PARENT),
      ],
    })
    mocks.getDb.mockResolvedValue(db)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res.body.error).toBe('parent_csw_conflict')
  })

  // -------------------------- Happy path --------------------------

  it('returns 200 with the full data envelope on happy path', async () => {
    const db = makeFakeDb({
      selectResponses: [
        profilesSelectResponse(EMBEDDED_EOA),
        ciecSelectResponse(null), // no prior row
      ],
    })
    mocks.getDb.mockResolvedValue(db)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      profileId: PROFILE_ID,
      parentAddress: PARENT_CSW,
      subAccountAddress: SUB_ACCOUNT,
      embeddedEoaAddress: EMBEDDED_EOA,
      ownerIndex: 0,
      provisioningSource: 'baseapp_waitlist',
    })
  })

  it('upserts CIEC, wallets, profile_wallets, and profiles via runInTransaction', async () => {
    const db = makeFakeDb({
      selectResponses: [
        profilesSelectResponse(EMBEDDED_EOA),
        ciecSelectResponse(null),
      ],
    })
    mocks.getDb.mockResolvedValue(db)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)

    expect(mocks.runInTransaction).toHaveBeenCalledTimes(1)

    const sqlText = db.calls.map((c) => c.sql).join('\n--SEP--\n')
    expect(sqlText).toContain('command_issuer_execution_context')
    expect(sqlText).toContain('provisioning_source')
    expect(sqlText).toContain('INTO wallets')
    expect(sqlText).toContain('profile_wallets')
    expect(sqlText).toContain('is_canonical_smart_wallet')
    // The handler unsets is_canonical_smart_wallet on prior canonical
    // rows for the profile so the parent CSW can become the canonical
    // wallet without violating the partial unique index.
    expect(sqlText).toMatch(/UPDATE profile_wallets[\s\S]*is_canonical_smart_wallet = false/i)
    // And it sets is_canonical_smart_wallet = true on the parent CSW row.
    expect(sqlText).toMatch(/INSERT INTO profile_wallets[\s\S]*is_canonical_smart_wallet/i)
    expect(sqlText).toContain('base_sub_account')
    expect(sqlText).toContain('csw_address')
  })

  it('is idempotent: same body twice produces 200 both times', async () => {
    const dbA = makeFakeDb({
      selectResponses: [
        profilesSelectResponse(EMBEDDED_EOA),
        ciecSelectResponse(null),
      ],
    })
    mocks.getDb.mockResolvedValue(dbA)
    const reqA = createMockReq({ method: 'POST' })
    const resA = createMockRes()
    await handler(reqA, resA)
    expect(resA.statusCode).toBe(200)

    // Second call: prior row now exists with same parent. Handler must
    // NOT 409 — same parent is allowed and produces a successful upsert.
    const dbB = makeFakeDb({
      selectResponses: [
        profilesSelectResponse(EMBEDDED_EOA),
        ciecSelectResponse(PARENT_CSW),
      ],
    })
    mocks.getDb.mockResolvedValue(dbB)
    const reqB = createMockReq({ method: 'POST' })
    const resB = createMockRes()
    await handler(reqB, resB)
    expect(resB.statusCode).toBe(200)
    expect(resB.body.data.parentAddress).toBe(PARENT_CSW)
  })

  // -------------------------- Rollback / partial failure --------------------------

  it('returns unexpected_error when profile_wallets upsert fails mid-flight', async () => {
    const db = makeFakeDb({
      selectResponses: [
        profilesSelectResponse(EMBEDDED_EOA),
        ciecSelectResponse(null),
      ],
      failOn: {
        match: 'INSERT INTO profile_wallets',
        error: new Error('simulated_pw_failure'),
      },
    })
    mocks.getDb.mockResolvedValue(db)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(500)
    expect(res.body.error).toBe('unexpected_error')

    expect(mocks.runInTransaction).toHaveBeenCalledTimes(1)
  })

  // -------------------------- Rate limit --------------------------

  it('returns 429 when rate limit denies the request', async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body.error).toBe('too_many_requests')
  })
})
