import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'
import { getV1ApiHandler } from '../_handlers/_routes.v1.ts'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  guardAgentApiRequest: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 100, resetAt: Date.now() + 60_000 })),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  getDb: vi.fn(),
  isDbConfigured: vi.fn(() => true),
  ensureCreatorMetricsSchema: vi.fn(async () => undefined),
  ensureKeeprSchema: vi.fn(async () => undefined),
  sql: vi.fn(async (..._args: unknown[]) => ({ rows: [] as Record<string, unknown>[] })),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: mocks.handleOptions,
  guardAgentApiRequest: mocks.guardAgentApiRequest,
  getClientIp: mocks.getClientIp,
  checkRateLimit: mocks.checkRateLimit,
  rateLimitKey: mocks.rateLimitKey,
  getDb: mocks.getDb,
  isDbConfigured: mocks.isDbConfigured,
  RATE_LIMITS: {
    exploreRead: { windowMs: 60_000, maxRequests: 120 },
  },
}))

vi.mock('../../server/_lib/zora/creatorMetricsSync.js', () => ({
  ensureCreatorMetricsSchema: mocks.ensureCreatorMetricsSchema,
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: mocks.ensureKeeprSchema,
}))

import exploreVaultsHandler from '../_handlers/v1/explore/_vaults.ts'

function lastSqlText(): string {
  expect(mocks.sql).toHaveBeenCalled()
  const lastCall = mocks.sql.mock.calls.at(-1)
  expect(lastCall).toBeTruthy()
  const strings = lastCall?.[0]
  expect(Array.isArray(strings)).toBe(true)
  return (strings as unknown as TemplateStringsArray).join(' ')
}

describe('v1 explore vaults route registration', () => {
  it('registers explore/vaults in the v1 route family', async () => {
    await expect(getV1ApiHandler('explore/vaults')).resolves.toBeTypeOf('function')
  })
})

describe('GET /api/v1/explore/vaults synthetic Keepr exclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60_000 })
    mocks.isDbConfigured.mockReturnValue(true)
    mocks.getDb.mockResolvedValue({ sql: mocks.sql })
    mocks.sql.mockResolvedValue({ rows: [] })
  })

  it('excludes room-channel synthetic vaults and pending-bootstrap groups in SQL', async () => {
    const req = createMockReq({ method: 'GET', query: { time: '1y' } })
    const res = createMockRes()
    await exploreVaultsHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)

    const sql = lastSqlText()
    expect(sql).toContain('alfaclub.room_channel_bindings')
    expect(sql).toContain('synthetic_keepr_vault_address')
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain("NOT LIKE 'pending-bootstrap:alfaclub-room:%'")
  })

  it('returns real CreatorOVault keepr rows', async () => {
    const realVault = '0x4626539e5c01cc32c29755146d31755e3ada848a'
    const creatorCoin = '0x5b674196812451b7cec024fe9d22d2c0b172fa75'
    mocks.sql.mockResolvedValue({
      rows: [
        {
          vault_address: realVault,
          chain_id: 8453,
          creator_coin_address: creatorCoin,
          share_token_address: '0x1111111111111111111111111111111111111111',
          group_id: 'akita-vault-group',
          graduated_at: null,
          settled_at: '2026-07-01T00:00:00.000Z',
          settlement_stage: 'settled',
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-07-01T00:00:00.000Z',
          market_cap_usd: 1000,
          volume_24h_usd: 50,
          fees_24h_usd: 1,
        },
      ],
    })

    const req = createMockReq({ method: 'GET', query: { time: '1y' } })
    const res = createMockRes()
    await exploreVaultsHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.items).toHaveLength(1)
    expect(res.body?.data?.items[0]).toMatchObject({
      vaultAddress: realVault,
      creatorCoinAddress: creatorCoin,
      groupId: 'akita-vault-group',
      settledAt: '2026-07-01T00:00:00.000Z',
    })

    const sql = lastSqlText()
    expect(sql).toContain('NOT EXISTS')
    expect(sql).toContain("NOT LIKE 'pending-bootstrap:alfaclub-room:%'")
  })
})
