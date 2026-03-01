import { describe, expect, it } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const PHASE_ONE_BUILD_ROUTES = [
  'v1/build/auction/submitBid',
  'v1/build/gauge/vote',
  'v1/build/gauge/resetVotes',
  'v1/build/ve4626/lock',
  'v1/build/ve4626/extend',
  'v1/build/ve4626/increase',
  'v1/build/ve4626/unlock',
] as const

describe('v1 phase 1 build routes (catch-all)', () => {
  it('routes phase 1 build endpoints to handlers (not 404)', async () => {
    const mod = await import('../[...path].ts')
    const handler = mod.default

    for (const route of PHASE_ONE_BUILD_ROUTES) {
      const req = createMockReq({
        method: 'GET',
        query: { path: route },
        url: `/api/${route}`,
      })
      const res = createMockRes()

      await handler(req, res)

      // GET should hit each handler and be rejected by method guard (405),
      // which proves route registration in _routes.ts is active.
      expect(res.statusCode).toBe(405)
      expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
    }
  })
})
