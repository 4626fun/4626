import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/_provisionSolanaRoute.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
}))

describe('deploy provisionSolanaRoute handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 without bearer secret', async () => {
    const restoreEnv = applyEnv({
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: 'test-secret',
    })
    try {
      const req = createMockReq({
        method: 'POST',
        body: { bridgeToken: '0x49b2FC0E4582F0AeA8c733993A8e18508de7Cd86' },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(res.body?.success).toBe(false)
      expect(String(res.body?.error ?? '')).toContain('Unauthorized')
    } finally {
      restoreEnv()
    }
  })

  it('returns 503 when CLI dir is missing', async () => {
    const restoreEnv = applyEnv({
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: 'test-secret',
      SOLANA_BRIDGE_CLI_DIR: '/definitely/missing/path',
    })
    try {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-secret' },
        body: { bridgeToken: '0x49b2FC0E4582F0AeA8c733993A8e18508de7Cd86' },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(res.body?.success).toBe(false)
      expect(String(res.body?.error ?? '')).toContain('SOLANA_BRIDGE_CLI_DIR')
    } finally {
      restoreEnv()
    }
  })
})

