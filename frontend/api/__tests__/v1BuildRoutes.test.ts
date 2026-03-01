import { describe, expect, it } from 'vitest'

import { getApiHandler } from '../_handlers/_routes.js'

describe('v1 build route registration', () => {
  it('resolves phase 1 and Ajna build endpoints', async () => {
    const enabledRoutes = [
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
    ]

    for (const route of enabledRoutes) {
      const handler = await getApiHandler(route)
      expect(typeof handler).toBe('function')
    }
  })

  it('leaves non-enabled build endpoints unresolved', async () => {
    const futureRoutes = [
      'v1/build/charm/rebalance',
      'v1/build/charm/vault/rebalance',
    ]

    for (const route of futureRoutes) {
      const handler = await getApiHandler(route)
      expect(handler).toBeNull()
    }
  })
})
