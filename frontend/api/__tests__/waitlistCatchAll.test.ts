import { describe, expect, it } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

describe('waitlist catch-all routing', () => {
  it('routes /api/waitlist to the root waitlist handler instead of returning 404', async () => {
    const mod = await import('../waitlist/[...path].ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      url: '/api/waitlist',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })
})
