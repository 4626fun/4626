import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { ensureKeeprSchemaMock, getDbMock, normalizeKeeprActionStatusForWorkspaceMock } = vi.hoisted(() => ({
  ensureKeeprSchemaMock: vi.fn(async () => {}),
  getDbMock: vi.fn(),
  normalizeKeeprActionStatusForWorkspaceMock: vi.fn(async () => undefined),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: () => false,
  readJsonBody: async (req: any) => req.body,
  readBoundedJsonObjectBody: async (req: any) => (typeof req.body === 'object' && req.body !== null ? req.body : null),
  setCors: () => undefined,
  setNoStore: () => undefined,
  getDb: getDbMock,
  getClientIp: () => '127.0.0.1',
  rateLimitKey: (...parts: string[]) => parts.join(':'),
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetAt: Date.now() + 60_000 }),
  RATE_LIMITS: {
    creRuntimeDecisionsWrite: { windowMs: 60_000, maxRequests: 60 },
  },
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

vi.mock('../../server/_lib/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

vi.mock('../../server/_lib/workspace/normalizer.js', () => ({
  normalizeKeeprActionStatusForWorkspace: normalizeKeeprActionStatusForWorkspaceMock,
}))

import handler from '../_handlers/keepr/actions/_updateStatus.ts'

describe('keepr/actions/updateStatus', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      KEEPR_API_KEY: 'test-keepr-key',
      KEEPR_ZONE_KEY_FINANCIAL_EXECUTION: 'zone-financial-secret',
      KEEPR_ZONE_KEY_MARKET_MAINTENANCE: 'zone-market-secret',
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('authorizes status updates from the effective stored action payload, not only action_type', async () => {
    const sqlMock = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ')
      if (query.includes('SELECT action_type')) {
        return {
          rows: [
            {
              action_type: 'monitor.healthcheck',
              action: {
                action: 'strategy.ajna.rebucket',
                authAddress: '0x00000000000000000000000000000000000000cc',
                targetBucket: 1200,
              },
            },
          ],
        }
      }
      if (query.includes('UPDATE keepr_actions')) {
        return { rows: [{ id: 11 }] }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql: sqlMock })

    const req = createMockReq({
      method: 'POST',
      headers: {
        authorization: 'Bearer test-keepr-key',
        'x-keepr-zone-key': 'zone-financial-secret',
      },
      body: {
        id: 11,
        status: 'executing',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toEqual({
      id: 11,
      status: 'executing',
      trustZone: 'financial_execution',
      updated: true,
    })
  })
})
