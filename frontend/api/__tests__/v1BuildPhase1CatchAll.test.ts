import { describe, expect, it } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const ENABLED_BUILD_ROUTES = [
  'v1/build/auction/submitBid',
  'v1/build/gauge/vote',
  'v1/build/gauge/resetVotes',
  'v1/build/ve4626/lock',
  'v1/build/ve4626/extend',
  'v1/build/ve4626/increase',
  'v1/build/ve4626/unlock',
  'v1/build/ajna/borrow',
  'v1/build/ajna/repay',
  'v1/build/ajna/addCollateral',
  'v1/build/ajna/removeCollateral',
  'v1/build/ajna/setBucketIndex',
  'v1/build/ajna/moveToBucket',
  'v1/build/ajna/setIdleBufferBps',
  'v1/build/charm/setCharmVault',
  'v1/build/charm/setSwapPool',
  'v1/build/charm/setUniFactory',
  'v1/build/charm/setAutoFeeTier',
  'v1/build/charm/setParameters',
  'v1/build/charm/setActive',
  'v1/build/charm/initializeApprovals',
  'v1/build/charm/rebalance',
  'v1/build/charm/ownerEmergencyWithdraw',
  'v1/build/charm/ownerEmergencyWithdrawFromCharm',
  'v1/build/charm/vault/rebalance',
  'v1/build/charm/vault/setStrategy',
] as const

describe('v1 enabled build routes (catch-all)', () => {
  it('routes enabled build endpoints to handlers (not 404)', async () => {
    const mod = await import('../[...path].ts')
    const handler = mod.default

    for (const route of ENABLED_BUILD_ROUTES) {
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
