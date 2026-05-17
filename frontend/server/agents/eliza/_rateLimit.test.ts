import { describe, expect, it } from 'vitest'

import { SlidingWindowRateLimiter } from './_rateLimit.ts'

describe('sliding window rate limiter bounds', () => {
  it('evicts stale/old buckets when max key bound is reached', () => {
    const limiter = new SlidingWindowRateLimiter(1_000, 3, {
      maxKeys: 2,
      idleTtlMs: 500,
    })

    expect(limiter.allow('k1', 1_000).allowed).toBe(true)
    expect(limiter.allow('k2', 1_001).allowed).toBe(true)
    expect(limiter.getDebugState().trackedKeys).toBe(2)

    // k1 is now stale by idle TTL and should be dropped before admitting k3.
    expect(limiter.allow('k3', 1_700).allowed).toBe(true)
    const state = limiter.getDebugState()
    expect(state.trackedKeys).toBeLessThanOrEqual(2)
    expect(state.keys.includes('k1')).toBe(false)
    expect(state.keys.includes('k3')).toBe(true)
  })
})

