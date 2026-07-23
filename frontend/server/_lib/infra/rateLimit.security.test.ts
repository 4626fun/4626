import { describe, expect, it, vi } from 'vitest'

import { enforceDualRateLimit } from './rateLimit.js'

describe('enforceDualRateLimit write amplification guard', () => {
  it('does not create token-fingerprint buckets after the IP bucket is exhausted', async () => {
    const check = vi.fn(async (key: string) => ({
      allowed: false,
      remaining: 0,
      resetAt: 123,
      key,
    }))
    await enforceDualRateLimit({
      scope: 'accounts',
      req: { headers: { authorization: 'Bearer attacker-controlled-token' } },
      ip: '203.0.113.9',
      sessionConfig: { windowMs: 60_000, maxRequests: 10 },
      ipConfig: { windowMs: 60_000, maxRequests: 5 },
      check,
    })
    expect(check).toHaveBeenCalledTimes(1)
    expect(check.mock.calls[0]?.[0]).toBe('accounts:203.0.113.9')
  })
})
