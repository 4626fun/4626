import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes, readSetCookies } from './helpers'

const {
  getDbMock,
  readRequestPrincipalAddressMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  readRequestPrincipalAddressMock: vi.fn(() => ''),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 99, resetAt: Date.now() + 60_000 })),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: (...parts: string[]) => parts.filter(Boolean).join(':'),
}))

import createHandoffHandler from '../_handlers/auth/_handoff-create.ts'
import redeemHandoffHandler from '../_handlers/auth/_handoff-redeem.ts'

type HandoffRecord = {
  address: string
  privyToken: string | null
  expiresAtMs: number
  consumedAtMs: number | null
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
      if (text.includes('create index if not exists auth_handoffs_expires_idx')) {
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
      if (text.includes('update auth_handoffs') && text.includes('returning address')) {
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
      AUTH_SESSION_SECRET: 'test-auth-session-secret-123456',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('requires authenticated principal for handoff creation', async () => {
    getDbMock.mockResolvedValue(createHandoffDb())
    readRequestPrincipalAddressMock.mockReturnValue('')

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await createHandoffHandler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
  })

  it('creates and redeems one-time handoff codes', async () => {
    const db = createHandoffDb()
    getDbMock.mockResolvedValue(db)
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')

    const createReq = createMockReq({ method: 'POST' })
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
    expect(String(redeemRes.body?.data?.address ?? '')).toBe('0x00000000000000000000000000000000000000aa')
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
})
