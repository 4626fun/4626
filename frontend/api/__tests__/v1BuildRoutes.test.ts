import { describe, expect, it } from 'vitest'

import { getApiHandler } from '../_handlers/_routes.js'

describe('v1 build route registration', () => {
  it('resolves all phase 1 build endpoints', async () => {
    const phaseOneRoutes = [
      'v1/build/auction/submitBid',
      'v1/build/gauge/vote',
      'v1/build/gauge/resetVotes',
      'v1/build/ve4626/lock',
      'v1/build/ve4626/extend',
      'v1/build/ve4626/increase',
      'v1/build/ve4626/unlock',
    ]

    for (const route of phaseOneRoutes) {
      const handler = await getApiHandler(route)
      expect(typeof handler).toBe('function')
    }
  })

  it('leaves non-enabled build endpoints unresolved', async () => {
    const futureRoutes = [
      'v1/build/ajna/borrow',
      'v1/build/charm/rebalance',
      'v1/build/charm/vault/rebalance',
    ]

    for (const route of futureRoutes) {
      const handler = await getApiHandler(route)
      expect(handler).toBeNull()
    }
  })
})
