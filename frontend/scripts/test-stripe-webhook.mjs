#!/usr/bin/env node
/**
 * End-to-end Stripe webhook test.
 *
 * Constructs a fake `checkout.session.completed` event, signs it with
 * our `STRIPE_WEBHOOK_SECRET` using the canonical `v1=HMAC-SHA256`
 * signature format Stripe uses (identical to what the Stripe Dashboard's
 * "Send test webhook" button produces), then POSTs it to the prod
 * webhook endpoint. Reports the response so we can verify:
 *
 *   - 400 signature_invalid → env mismatch (STRIPE_WEBHOOK_SECRET wrong
 *     or not loaded)
 *   - 400 invalid wallet_address → metadata shape mismatch
 *   - 404 session_not_found → signature verified AND handler ran, but
 *     there's no DB row matching the test session id (EXPECTED for a
 *     synthetic test; means the signature + processing path works)
 *   - 200 ok → full path worked (only happens if a DB row already
 *     exists for the synthetic session id, which it won't)
 *
 * We expect 404 session_not_found. That's the green result.
 *
 * Usage:
 *   pnpm -C frontend exec node scripts/test-stripe-webhook.mjs
 */

import crypto from 'node:crypto'

const WEBHOOK_URL =
  process.env.STRIPE_WEBHOOK_TEST_URL ??
  'https://4626.fun/api/creator/strategy/stripe/webhook'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

if (!WEBHOOK_SECRET) {
  console.error(
    'Error: STRIPE_WEBHOOK_SECRET env var is required. Source it from frontend/.env or Vercel.',
  )
  process.exit(2)
}

// Synthetic event shaped like a real checkout.session.completed payload.
// Metadata fields match what `/api/creator/strategy/stripe/checkout`
// sets on the real Stripe Checkout Session, so the webhook's reader can
// decode them cleanly.
const eventId = `evt_test_${crypto.randomBytes(8).toString('hex')}`
const sessionId = `cs_test_${crypto.randomBytes(12).toString('hex')}`
const unixTs = Math.floor(Date.now() / 1000)

const payload = {
  id: eventId,
  object: 'event',
  api_version: '2024-12-18.acacia',
  created: unixTs,
  livemode: false,
  pending_webhooks: 1,
  type: 'checkout.session.completed',
  data: {
    object: {
      id: sessionId,
      object: 'checkout.session',
      amount_subtotal: 10_000,
      amount_total: 10_000,
      currency: 'usd',
      customer: null,
      customer_email: null,
      livemode: false,
      metadata: {
        creator_token: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        wallet_address: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
        feature_key: 'solana_meteora_alpha_vault',
        price_usdc: '100000000',
      },
      mode: 'payment',
      payment_intent: `pi_test_${crypto.randomBytes(12).toString('hex')}`,
      payment_method_types: ['card'],
      payment_status: 'paid',
      status: 'complete',
      success_url: 'https://app.4626.fun/creator/strategy/activation-success',
    },
  },
}
const rawBody = JSON.stringify(payload)

// Build the Stripe-Signature header. Format:
//   t=<unix ts>,v1=<HMAC-SHA256(ts + "." + rawBody, secret)>
// Stripe's `constructEvent` accepts this exact format.
const signedPayload = `${unixTs}.${rawBody}`
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(signedPayload, 'utf8')
  .digest('hex')
const stripeSignatureHeader = `t=${unixTs},v1=${signature}`

console.log('=== test-stripe-webhook ===')
console.log(`target:      ${WEBHOOK_URL}`)
console.log(`event:       ${payload.type}`)
console.log(`event id:    ${eventId}`)
console.log(`session id:  ${sessionId}`)
console.log(`secret hint: ${WEBHOOK_SECRET.slice(0, 8)}… (${WEBHOOK_SECRET.length} chars)`)
console.log()

const startedAt = Date.now()
const response = await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'stripe-signature': stripeSignatureHeader,
  },
  body: rawBody,
})
const elapsedMs = Date.now() - startedAt
const bodyText = await response.text()

console.log(`status:      ${response.status} (${elapsedMs}ms)`)
console.log('body:')
try {
  console.log(JSON.stringify(JSON.parse(bodyText), null, 2))
} catch {
  console.log(bodyText.slice(0, 500))
}
console.log()

if (response.status === 200) {
  console.log('✅ 200 — signature verified and event processed cleanly (unexpected for synthetic test unless a real row exists)')
  process.exit(0)
} else if (response.status === 404) {
  console.log('✅ 404 session_not_found — EXPECTED: signature verified + handler ran, no DB row matches synthetic session id')
  process.exit(0)
} else if (response.status === 400) {
  if (bodyText.includes('signature_invalid')) {
    console.log(
      '❌ 400 signature_invalid — webhook secret mismatch. Check STRIPE_WEBHOOK_SECRET in Vercel matches the Stripe Dashboard signing secret.',
    )
  } else if (bodyText.includes('wallet_address')) {
    console.log(
      '❌ 400 invalid wallet_address — our metadata shape is wrong. This is unlikely since we control the test payload.',
    )
  } else {
    console.log('❌ 400 — see body above')
  }
  process.exit(1)
} else if (response.status === 503) {
  console.log('❌ 503 — env not configured (STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET unset on the server)')
  process.exit(1)
} else {
  console.log(`⚠️  Unexpected status ${response.status}`)
  process.exit(1)
}
