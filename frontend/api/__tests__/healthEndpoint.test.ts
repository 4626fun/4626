import { describe, expect, it } from 'vitest'

import handler from '../_handlers/health/_health'
import { createMockReq, createMockRes } from './helpers'

describe('health endpoint disclosure boundary', () => {
  it('returns only public liveness fields without admin authentication', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({
      ok: true,
      time: expect.any(String),
    })
    expect(JSON.stringify(res.body)).not.toContain('adminToken')
    expect(JSON.stringify(res.body)).not.toContain('serviceRoleConfigured')
    expect(JSON.stringify(res.body)).not.toContain('DEPLOY_SESSION_TOKEN_HMAC_SECRET')
  })
})
