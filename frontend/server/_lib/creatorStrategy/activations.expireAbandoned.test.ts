import { describe, expect, it, vi } from 'vitest'

import { expireAbandonedStripeCheckoutActivations } from './activations.js'

describe('expireAbandonedStripeCheckoutActivations', () => {
  it('marks unpaid stripe pending rows older than the TTL as failed', async () => {
    const sql = vi.fn(async () => ({ rows: [{ id: 7 }, { id: 8 }] }))
    const expired = await expireAbandonedStripeCheckoutActivations(
      { sql },
      {
        creatorToken: '0x2222222222222222222222222222222222222222',
        featureKey: 'vault_full_deploy',
        olderThanMs: 60_000,
      },
    )
    expect(expired).toBe(2)
    expect(sql).toHaveBeenCalledTimes(1)
    const call = sql.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]]
    const fragments = Array.from(call[0]).join(' ')
    expect(fragments).toMatch(/stripe_checkout_abandoned/)
    expect(fragments).toMatch(/payment_verified_at IS NULL/)
    expect(fragments).toMatch(/payment_source =/)
  })

  it('returns 0 for empty feature keys without querying', async () => {
    const sql = vi.fn(async () => ({ rows: [] }))
    const expired = await expireAbandonedStripeCheckoutActivations(
      { sql },
      {
        creatorToken: '0x2222222222222222222222222222222222222222',
        featureKey: '',
      },
    )
    expect(expired).toBe(0)
    expect(sql).not.toHaveBeenCalled()
  })
})
