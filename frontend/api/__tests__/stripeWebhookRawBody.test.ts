import { describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/creator/strategy/stripe/_webhook'
import { createMockReq, createMockRes } from './helpers'

const { verifyStripeWebhookMock } = vi.hoisted(() => ({
  verifyStripeWebhookMock: vi.fn(),
}))

vi.mock('../../server/_lib/creatorStrategy/stripe.js', () => ({
  isStripeWebhookConfigured: vi.fn(() => true),
  verifyStripeWebhook: verifyStripeWebhookMock,
}))

describe('Stripe webhook raw-body boundary', () => {
  it('rejects a pre-parsed body instead of re-serializing signed JSON', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'stripe-signature': 'test-signature' },
      body: { type: 'checkout.session.completed' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toContain('raw_body_unavailable')
    expect(verifyStripeWebhookMock).not.toHaveBeenCalled()
  })
})
