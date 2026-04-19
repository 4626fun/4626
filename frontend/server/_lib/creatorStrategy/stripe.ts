/**
 * Stripe integration for creator strategy feature activation.
 *
 * Lets creators pay by credit card instead of on-chain USDC. The flow
 * is the canonical Stripe Checkout + webhook pattern:
 *
 *   1. Client POSTs `{ creatorToken, featureKey }` to
 *      `/api/creator/strategy/stripe/checkout`.
 *   2. Server resolves the effective USDC-denominated price (catalog +
 *      discount override), converts to USD cents (1 USDC = 1 USD), and
 *      creates a Stripe Checkout Session with mode=payment.
 *   3. Server inserts a `pending` `creator_strategy_features` row with
 *      `payment_source = 'stripe'` and `stripe_checkout_session_id` set,
 *      then returns the session URL.
 *   4. Client redirects to the URL; user enters card; Stripe processes.
 *   5. Stripe posts `checkout.session.completed` to our webhook.
 *   6. Webhook verifies the signature, looks up the row by session id,
 *      and flips `status` to `pending` (already was) + populates
 *      `stripe_payment_intent_id` / `stripe_charge_id` +
 *      `payment_verified_at`. Subsequent operator provisioning promotes
 *      to `active`.
 *
 * Notes:
 *   - We DO NOT rely on the redirect return URL for activation — the
 *     webhook is the source of truth (per Stripe best practice).
 *   - If the webhook fires before the row is inserted (shouldn't happen
 *     — `checkout.session.completed` is async), we gracefully no-op and
 *     log. Idempotency is handled by the unique
 *     `stripe_checkout_session_id` index.
 */

import type Stripe from 'stripe'

let cachedClient: Stripe | null = null

export function isStripeConfigured(): boolean {
  return typeof process.env.STRIPE_SECRET_KEY === 'string' && process.env.STRIPE_SECRET_KEY.length > 0
}

export function isStripeWebhookConfigured(): boolean {
  return (
    typeof process.env.STRIPE_WEBHOOK_SECRET === 'string' &&
    process.env.STRIPE_WEBHOOK_SECRET.length > 0
  )
}

/**
 * Lazily instantiate the Stripe client so the module is safe to import
 * in contexts where Stripe env isn't set (local dev, tests). Throws
 * with a clear message when the caller actually uses it without
 * configuration.
 */
export async function getStripeClient(): Promise<Stripe> {
  if (cachedClient) return cachedClient
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not set — Stripe payment path is unavailable')
  }
  const mod = (await import('stripe')) as unknown as { default: typeof Stripe }
  const StripeCtor = (mod as any).default ?? (mod as unknown as typeof Stripe)
  // Pin API version to avoid surprise-breaking upstream changes. Cast
  // to `any` for the config arg so we don't have to chase the literal
  // union type across minor SDK bumps.
  const instance = new StripeCtor(secret, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  } as any)
  cachedClient = instance
  return instance
}

/**
 * Convert a USDC-denominated price (6 decimals) into Stripe's expected
 * unit-amount (USD cents, integer). We assume USDC ≈ USD for pricing
 * purposes — the $0.001–0.01 depeg risk is acceptable for a $100 item.
 */
export function usdcToStripeUnitAmount(priceUsdc: bigint): number {
  // USDC has 6 decimals; Stripe wants cents (2 decimals).
  // unitAmount = floor(priceUsdc / 10_000)
  const cents = priceUsdc / 10_000n
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Stripe unit amount overflow: ${cents}`)
  }
  return Number(cents)
}

export type CreateCheckoutSessionInput = {
  creatorToken: `0x${string}`
  walletAddress: `0x${string}`
  featureKey: string
  featureDisplayName: string
  featureDescription: string
  priceUsdc: bigint
  successUrl: string
  cancelUrl: string
  clientReferenceId?: string
}

export type CreateCheckoutSessionResult = {
  sessionId: string
  sessionUrl: string
  unitAmountCents: number
}

/**
 * Wraps Stripe SDK's `checkout.sessions.create`. Keeps all
 * 4626-specific metadata on the session so the webhook can resolve it
 * back to the right activation row without a second DB call.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  const stripe = await getStripeClient()
  const unitAmount = usdcToStripeUnitAmount(input.priceUsdc)
  if (unitAmount <= 0) {
    throw new Error('Stripe unit amount must be > 0 (use a non-Stripe path for free activations)')
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: input.featureDisplayName,
            description: input.featureDescription,
          },
        },
        quantity: 1,
      },
    ],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.clientReferenceId,
    metadata: {
      creator_token: input.creatorToken.toLowerCase(),
      wallet_address: input.walletAddress.toLowerCase(),
      feature_key: input.featureKey,
      price_usdc: input.priceUsdc.toString(),
    },
  })

  if (!session.url) {
    throw new Error(`Stripe session ${session.id} created without a URL`)
  }
  return {
    sessionId: session.id,
    sessionUrl: session.url,
    unitAmountCents: unitAmount,
  }
}

/**
 * Verify + parse a Stripe webhook request. Returns the typed event or
 * a structured failure so the handler can reply with the right status
 * code.
 */
export type VerifyWebhookResult =
  | { ok: true; event: Stripe.Event }
  | { ok: false; reason: 'missing_signature' | 'webhook_not_configured' | 'signature_invalid'; message: string }

export async function verifyStripeWebhook(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
): Promise<VerifyWebhookResult> {
  if (!signatureHeader) {
    return { ok: false, reason: 'missing_signature', message: 'stripe-signature header missing' }
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return {
      ok: false,
      reason: 'webhook_not_configured',
      message: 'STRIPE_WEBHOOK_SECRET is not set',
    }
  }
  const stripe = await getStripeClient()
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret)
    return { ok: true, event }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: 'signature_invalid', message }
  }
}
