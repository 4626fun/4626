import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const CREATOR = '0x00000000000000000000000000000000000000aa'

const {
  readJsonBodyMock,
  getDbMock,
  isDbConfiguredMock,
  readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipalMock,
  resolvePersistedWalletIdentityMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async () => ({})),
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  readRequestPrincipalAddressMock: vi.fn(() => CREATOR),
  resolveAuthorizedRequestPrincipalMock: vi.fn(async () => ({
    canonicalSmartWalletAddress: CREATOR,
  })),
  resolvePersistedWalletIdentityMock: vi.fn(async () => null),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: readJsonBodyMock,
  getDb: getDbMock,
  isDbConfigured: isDbConfiguredMock,
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipal: resolveAuthorizedRequestPrincipalMock,
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    creatorQuickstart: { windowMs: 60_000, maxRequests: 20 },
  },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  resolvePersistedWalletIdentity: resolvePersistedWalletIdentityMock,
}))

vi.mock('../../server/_lib/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: vi.fn(),
}))

vi.mock('../../server/_lib/creatorXmtpAgents.js', () => ({
  enableCswAgent: vi.fn(),
  getOrCreateCreatorXmtpAgent: vi.fn(),
}))

vi.mock('../../server/_lib/coinParties.js', () => ({
  resolveCoinParties: vi.fn(),
  isAddressLike: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
}))

function createDb(allowlisted: boolean) {
  const statements: string[] = []
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
    statements.push(text)
    if (text.includes('from allowlist')) {
      if (!allowlisted) return { rows: [] }
      const addr = String(values[0] ?? '').toLowerCase()
      if (addr === CREATOR.toLowerCase()) {
        return { rows: [{ address: CREATOR.toLowerCase() }] }
      }
      return { rows: [] }
    }
    if (
      text.includes('insert into allowlist') ||
      text.includes('update allowlist') ||
      text.includes('delete from allowlist')
    ) {
      throw new Error('unexpected_allowlist_mutation')
    }
    return { rows: [] }
  })
  return { sql, statements }
}

describe('quickstart allowlist enforcement', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      ZORA_SERVER_API_KEY: undefined,
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('returns 403 when creator is not pre-approved', async () => {
    const db = createDb(false)
    getDbMock.mockResolvedValue(db)
    const mod = await import('../_handlers/v1/creators/_quickstart.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'POST', body: { enableAutomation: false } })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('pending approval')
    expect(db.statements.some((sql) => sql.includes('insert into allowlist'))).toBe(false)
  })

  it('allows approved creators without mutating allowlist', async () => {
    const db = createDb(true)
    getDbMock.mockResolvedValue(db)
    const mod = await import('../_handlers/v1/creators/_quickstart.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'POST', body: { enableAutomation: false } })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.allowlisted).toBe(true)
    expect(db.statements.some((sql) => sql.includes('insert into allowlist'))).toBe(false)
    expect(db.statements.some((sql) => sql.includes('update allowlist'))).toBe(false)
  })
})
