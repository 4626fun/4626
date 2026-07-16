import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes, readSetCookies } from './helpers'

const CANONICAL = '0x00000000000000000000000000000000000000aa'
const EMBEDDED = '0x00000000000000000000000000000000000000bb'
const OTHER = '0x00000000000000000000000000000000000000cc'

const {
  getDbMock,
  resolveAuthorizedRequestPrincipalMock,
  resolveAuthorizedWalletProfileMock,
  checkDurableRateLimitMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  resolveAuthorizedRequestPrincipalMock: vi.fn(),
  resolveAuthorizedWalletProfileMock: vi.fn(),
  checkDurableRateLimitMock: vi.fn(() =>
    Promise.resolve({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 }),
  ),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/wallet/canonicalWalletResolver.js', () => ({
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))

vi.mock('@4626/server-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@4626/server-core')>()
  return {
    ...actual,
    getDb: getDbMock,
    resolveAuthorizedRequestPrincipal: resolveAuthorizedRequestPrincipalMock,
    checkDurableRateLimit: checkDurableRateLimitMock,
    getClientIp: vi.fn(() => '127.0.0.1'),
    rateLimitKey: (...parts: string[]) => parts.filter(Boolean).join(':'),
  }
})

import createHandoffHandler from '../_handlers/auth/_handoff-create.ts'
import redeemHandoffHandler from '../_handlers/auth/_handoff-redeem.ts'

type HandoffRecord = {
  address: string
  privyToken: string | null
  expiresAtMs: number
  consumedAtMs: number | null
}

function authorizedPrincipal(params: {
  address: string
  canonicalSmartWalletAddress?: string | null
  activeOwnerWalletAddress?: string | null
  profileId?: number
}) {
  return {
    source: 'session' as const,
    authSource: 'session' as const,
    address: params.address,
    profileId: params.profileId ?? 1,
    canonicalSmartWalletAddress: params.canonicalSmartWalletAddress ?? null,
    activeOwnerWalletAddress: params.activeOwnerWalletAddress ?? null,
    signerRole:
      params.canonicalSmartWalletAddress === params.address
        ? ('canonical_smart_wallet' as const)
        : ('active_owner_wallet' as const),
  }
}

function createHandoffDb() {
  const rows = new Map<string, HandoffRecord>()

  return {
    rows,
    sql: async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')

      if (text.includes('create table if not exists auth_handoffs')) {
        return { rows: [] }
      }
      if (text.includes('index') && text.includes('auth_handoffs')) {
        return { rows: [] }
      }
      if (text.includes('alter table auth_handoffs')) {
        return { rows: [] }
      }
      if (text.includes('insert into auth_handoffs')) {
        const codeHash = String(values[0] ?? '')
        const address = String(values[1] ?? '').toLowerCase()
        const privyToken = values[2] != null ? String(values[2]) : null
        const expiresAtMs = Date.parse(String(values[3] ?? ''))
        if (!rows.has(codeHash)) {
          rows.set(codeHash, {
            address,
            privyToken,
            expiresAtMs,
            consumedAtMs: null,
          })
        }
        return { rows: [] }
      }
      if (text.includes('auth_handoffs') && text.includes('returning') && text.includes('privy_token')) {
        const codeHash = String(values[0] ?? '')
        const record = rows.get(codeHash)
        if (!record) return { rows: [] }
        if (record.consumedAtMs !== null) return { rows: [] }
        if (!Number.isFinite(record.expiresAtMs) || record.expiresAtMs <= Date.now()) return { rows: [] }
        const privyToken = record.privyToken
        record.consumedAtMs = Date.now()
        record.privyToken = null
        return { rows: [{ address: record.address, privy_token: privyToken }] }
      }

      return { rows: [] }
    },
  }
}

describe('auth handoff endpoints', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      // getHandoffHashSecret() requires ≥32 chars; the prior value (31) was
      // failing silently behind a try/catch → 503 response.
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567',
    })
    checkDurableRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 99,
      resetAt: Date.now() + 60_000,
    })
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue(
      authorizedPrincipal({
        address: CANONICAL,
        canonicalSmartWalletAddress: CANONICAL,
        activeOwnerWalletAddress: EMBEDDED,
      }),
    )
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWalletAddress: CANONICAL,
      activeOwnerWalletAddress: EMBEDDED,
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('requires authenticated principal for handoff creation', async () => {
    getDbMock.mockResolvedValue(createHandoffDb())
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue(null)

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await createHandoffHandler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
  })

  it('rejects handoff creation when the refreshed principal changed', async () => {
    getDbMock.mockResolvedValue(createHandoffDb())

    const req = createMockReq({
      method: 'POST',
      body: { expectedAddress: OTHER },
    })
    const res = createMockRes()
    await createHandoffHandler(req as any, res as any)

    expect(res.statusCode).toBe(409)
    expect(res.body?.code).toBe('SESSION_PRINCIPAL_CHANGED')
  })

  it('stores the canonical CSW when the cookie is a linked embedded owner', async () => {
    const db = createHandoffDb()
    getDbMock.mockResolvedValue(db)
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue(
      authorizedPrincipal({
        address: EMBEDDED,
        canonicalSmartWalletAddress: CANONICAL,
        activeOwnerWalletAddress: EMBEDDED,
      }),
    )

    const createReq = createMockReq({
      method: 'POST',
      body: { expectedAddress: EMBEDDED, privyToken: 'should-not-be-stored' },
    })
    const createRes = createMockRes()
    await createHandoffHandler(createReq as any, createRes as any)

    expect(createRes.statusCode).toBe(200)
    const stored = [...db.rows.values()]
    expect(stored).toHaveLength(1)
    expect(stored[0]?.address).toBe(CANONICAL)
    expect(stored[0]?.privyToken).toBeNull()
  })

  it('creates and redeems one-time handoff codes for the canonical principal', async () => {
    const db = createHandoffDb()
    getDbMock.mockResolvedValue(db)

    const createReq = createMockReq({
      method: 'POST',
      body: { expectedAddress: CANONICAL },
    })
    const createRes = createMockRes()
    await createHandoffHandler(createReq as any, createRes as any)

    expect(createRes.statusCode).toBe(200)
    expect(createRes.body?.success).toBe(true)
    const code = String(createRes.body?.data?.code ?? '')
    expect(code).toMatch(/^[a-f0-9]{64}$/i)

    const redeemReq = createMockReq({
      method: 'POST',
      body: { code },
    })
    const redeemRes = createMockRes()
    await redeemHandoffHandler(redeemReq as any, redeemRes as any)

    expect(redeemRes.statusCode).toBe(200)
    expect(redeemRes.body?.success).toBe(true)
    expect(String(redeemRes.body?.data?.address ?? '')).toBe(CANONICAL)
    expect(resolveAuthorizedWalletProfileMock).toHaveBeenCalledWith(CANONICAL)
    const setCookies = readSetCookies(redeemRes)
    expect(setCookies.some((cookie) => cookie.toLowerCase().includes('cv_auth_session='))).toBe(true)

    const replayReq = createMockReq({
      method: 'POST',
      body: { code },
    })
    const replayRes = createMockRes()
    await redeemHandoffHandler(replayReq as any, replayRes as any)

    expect(replayRes.statusCode).toBe(400)
    expect(replayRes.body?.error).toBe('Invalid or expired handoff code')
  })

  it('does not mint a redeem session for a revoked handoff principal', async () => {
    const db = createHandoffDb()
    getDbMock.mockResolvedValue(db)

    const createReq = createMockReq({ method: 'POST', body: { expectedAddress: CANONICAL } })
    const createRes = createMockRes()
    await createHandoffHandler(createReq as any, createRes as any)
    const code = String(createRes.body?.data?.code ?? '')

    resolveAuthorizedWalletProfileMock.mockResolvedValueOnce(null)

    const redeemReq = createMockReq({ method: 'POST', body: { code } })
    const redeemRes = createMockRes()
    await redeemHandoffHandler(redeemReq as any, redeemRes as any)

    expect(redeemRes.statusCode).toBe(400)
    expect(readSetCookies(redeemRes)).toEqual([])
  })

  it('does not leak privyToken in redeem response body (FINDING-02)', async () => {
    const db = createHandoffDb()
    getDbMock.mockResolvedValue(db)
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue(
      authorizedPrincipal({
        address: EMBEDDED,
        canonicalSmartWalletAddress: null,
        activeOwnerWalletAddress: EMBEDDED,
      }),
    )
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWalletAddress: null,
      activeOwnerWalletAddress: EMBEDDED,
    })

    const createReq = createMockReq({ method: 'POST', body: { privyToken: 'test-privy-jwt-abc123' } })
    const createRes = createMockRes()
    await createHandoffHandler(createReq as any, createRes as any)
    expect(createRes.statusCode).toBe(200)
    const code = String(createRes.body?.data?.code ?? '')
    expect([...db.rows.values()][0]?.privyToken).toBeNull()

    const redeemReq = createMockReq({ method: 'POST', body: { code } })
    const redeemRes = createMockRes()
    await redeemHandoffHandler(redeemReq as any, redeemRes as any)

    expect(redeemRes.statusCode).toBe(200)
    expect(redeemRes.body?.data?.address).toBe(EMBEDDED)
    expect(redeemRes.body?.data?.privyToken).toBeUndefined()
    expect(redeemRes.body?.data?.sessionToken).toBeUndefined()
  })

  it('rate-limits handoff creation requests', async () => {
    getDbMock.mockResolvedValue(createHandoffDb())
    checkDurableRateLimitMock.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await createHandoffHandler(req as any, res as any)

    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
  })

  it('rejects malformed handoff codes before touching the database', async () => {
    getDbMock.mockResolvedValue(createHandoffDb())

    const req = createMockReq({
      method: 'POST',
      body: { code: 'not-a-real-code' },
    })
    const res = createMockRes()
    await redeemHandoffHandler(req as any, res as any)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid handoff code')
    expect(resolveAuthorizedWalletProfileMock).not.toHaveBeenCalled()
  })
})
