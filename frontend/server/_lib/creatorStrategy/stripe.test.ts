import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usdcToStripeUnitAmount, verifyStripeWebhook } from './stripe'

describe('usdcToStripeUnitAmount', () => {
  it('converts exactly $100.00 USDC (6 decimals) to 10000 cents', () => {
    expect(usdcToStripeUnitAmount(100_000_000n)).toBe(10_000)
  })

  it('converts $50.25 cleanly', () => {
    expect(usdcToStripeUnitAmount(50_250_000n)).toBe(5_025)
  })

  it('floors sub-cent precision (USDC has 6 decimals, Stripe has 2)', () => {
    // $1.005 USDC (5 sub-cent USDC units) floors to $1.00 Stripe cents.
    expect(usdcToStripeUnitAmount(1_005_000n)).toBe(100)
  })

  it('throws if the resulting cents overflow Number.MAX_SAFE_INTEGER', () => {
    const huge = BigInt(Number.MAX_SAFE_INTEGER) * 10_000n + 10_000n
    expect(() => usdcToStripeUnitAmount(huge)).toThrow(/overflow/)
  })
})

describe('verifyStripeWebhook', () => {
  const priorSecret = process.env.STRIPE_SECRET_KEY
  const priorWebhook = process.env.STRIPE_WEBHOOK_SECRET

  beforeEach(() => {
    // Clear and set deterministic env for each test.
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
  })

  afterEach(() => {
    if (priorSecret !== undefined) process.env.STRIPE_SECRET_KEY = priorSecret
    if (priorWebhook !== undefined) process.env.STRIPE_WEBHOOK_SECRET = priorWebhook
    vi.restoreAllMocks()
  })

  it('rejects when no stripe-signature header is present', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
    const res = await verifyStripeWebhook('{}', undefined)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('missing_signature')
  })

  it('rejects when the webhook secret is not configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    // STRIPE_WEBHOOK_SECRET intentionally unset.
    const res = await verifyStripeWebhook('{}', 'any-sig')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('webhook_not_configured')
  })

  it('rejects an invalid signature (talks to real Stripe sdk)', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
    const res = await verifyStripeWebhook('{}', 't=1,v1=deadbeef')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('signature_invalid')
  })
})
