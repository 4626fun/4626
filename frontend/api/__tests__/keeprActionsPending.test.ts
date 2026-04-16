import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { ensureKeeprSchemaMock, getDbMock } = vi.hoisted(() => ({
  ensureKeeprSchemaMock: vi.fn(async () => {}),
  getDbMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: () => false,
  setCors: () => undefined,
  setNoStore: () => undefined,
  getDb: getDbMock,
  requireKeeprApiKey: (req: any, res: any, opts?: { missingSecretError?: string }) => {
    const expected = String(process.env.KEEPR_API_KEY ?? '').trim()
    if (!expected) {
      res.status(500).json({ success: false, error: opts?.missingSecretError ?? 'Server misconfigured' })
      return false
    }
    if (String(req.headers.authorization ?? '') !== `Bearer ${expected}`) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return false
    }
    return true
  },
  requireOptionalHeaderEnvAuth: (
    req: any,
    res: any,
    options: { envKey: string; headerName: string; unauthorizedError: string },
  ) => {
    const expected = String(process.env[options.envKey] ?? '').trim()
    if (!expected) return true
    const actual = String(req.headers[String(options.headerName).toLowerCase()] ?? '').trim()
    if (actual === expected) return true
    res.status(401).json({ success: false, error: options.unauthorizedError })
    return false
  },
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

import handler from '../_handlers/keepr/actions/_pending.ts'

describe('keepr/actions/pending', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      KEEPR_API_KEY: 'test-keepr-key',
      KEEPR_ZONE_KEY_FINANCIAL_EXECUTION: 'zone-financial-secret',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('filters and labels rows by the effective stored action payload, not only action_type', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({
        rows: [
          {
            id: 7,
            vault_address: '0x00000000000000000000000000000000000000bb',
            group_id: 'group-1',
            action_type: 'monitor.healthcheck',
            action: {
              action: 'strategy.ajna.rebucket',
              authAddress: '0x00000000000000000000000000000000000000cc',
              targetBucket: 1200,
            },
            dedupe_key: null,
            status: 'pending',
            attempt_count: 0,
            last_error: null,
            created_at: '2026-03-13T00:00:00.000Z',
          },
        ],
      })),
    })

    const req = createMockReq({
      method: 'GET',
      headers: {
        authorization: 'Bearer test-keepr-key',
        'x-keepr-zone-key': 'zone-financial-secret',
      },
      query: {
        zone: 'financial_execution',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.count).toBe(1)
    expect(res.body?.data?.actions).toEqual([
      expect.objectContaining({
        id: 7,
        trustZone: 'financial_execution',
      }),
    ])
  })
})
