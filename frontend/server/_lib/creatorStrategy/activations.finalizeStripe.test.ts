import { describe, expect, it, vi } from 'vitest'

import { finalizeStripeCheckoutActivation } from './activations.js'

describe('finalizeStripeCheckoutActivation', () => {
  it('revives abandoned failed Stripe rows back to pending on payment', async () => {
    const sql = vi.fn(async () => ({
      rows: [
        {
          id: 9,
          creator_token: '0x2222222222222222222222222222222222222222',
          feature_key: 'vault_full_deploy',
          status: 'pending',
          price_usdc_paid: '499000000',
          payment_tx_hash: null,
          payment_from: '0x1111111111111111111111111111111111111111',
          payment_to: null,
          payment_verified_at: '2026-07-26T01:00:00.000Z',
          provisioned_at: null,
          failed_at: null,
          refunded_at: null,
          provisioner_ref: null,
          failure_reason: null,
          metadata: {},
          created_at: '2026-07-26T00:00:00.000Z',
          updated_at: '2026-07-26T01:00:00.000Z',
        },
      ],
    }))

    const result = await finalizeStripeCheckoutActivation(
      { sql },
      {
        stripeCheckoutSessionId: 'cs_test_123',
        priceUsdcPaid: 499_000_000n,
        walletAddress: '0x1111111111111111111111111111111111111111',
        stripePaymentIntentId: 'pi_123',
        stripeChargeId: 'ch_123',
        paymentVerifiedAt: new Date('2026-07-26T01:00:00.000Z'),
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.row.status).toBe('pending')
    expect(result.row.failureReason).toBeNull()

    const call = sql.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]]
    const fragments = Array.from(call[0]).join(' ')
    expect(fragments).toMatch(/stripe_checkout_abandoned/)
    expect(fragments).toMatch(/THEN 'pending'/)
  })
})
