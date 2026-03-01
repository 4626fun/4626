import { describe, expect, it } from 'vitest'

import { getApiHandler } from '../_handlers/_routes.js'

describe('v1 build route registration', () => {
  it('resolves phase 1, Ajna, and Charm build endpoints', async () => {
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
      'v1/build/charm/setCharmVault',
      'v1/build/charm/setSwapPool',
      'v1/build/charm/setZRouter',
      'v1/build/charm/setUseZRouter',
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
    ]

    for (const route of enabledRoutes) {
      const handler = await getApiHandler(route)
      expect(typeof handler).toBe('function')
    }
  })

  it('leaves non-enabled build endpoints unresolved', async () => {
    const futureRoutes = [
      'v1/build/charm/notImplementedYet',
      'v1/build/ajna/notImplementedYet',
      'v1/build/future/unknown',
    ]

    for (const route of futureRoutes) {
      const handler = await getApiHandler(route)
      expect(handler).toBeNull()
    }
  })
})
