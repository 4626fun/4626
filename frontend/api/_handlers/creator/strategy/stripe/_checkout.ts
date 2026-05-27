import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'
import { getAddress, isAddress, type Address } from 'viem'

import {
  getCreatorStrategyFeature,
  getRetiredCreatorStrategyFeatureMessage,
} from '../../../../../server/_lib/creatorStrategy/catalog.js'
import { getAlacarteDeployPurchaseBlockedMessage } from '../../../../../server/_lib/creatorStrategy/bundleEntitlements.js'
import { insertStripeCheckoutActivation } from '../../../../../server/_lib/creatorStrategy/activations.js'
import { upsertPaymentOrder } from '../../../../../server/_lib/creatorStrategy/paymentOrders.js'
import {
  applyPriceOverride,
  findActivePriceOverride,
} from '../../../../../server/_lib/creatorStrategy/priceOverrides.js'
import {
  createCheckoutSession,
  isStripeConfigured,
} from '../../../../../server/_lib/creatorStrategy/stripe.js'

const REQUEST_BODY_MAX_BYTES = 4_096

type CheckoutBody = {
  creatorToken?: unknown
  featureKey?: unknown
  /**
   * Optional overrides for the success/cancel redirect URLs. When
   * omitted we build them from `STRIPE_RETURN_URL_BASE` +
   * standard paths.
   */
  successUrl?: unknown
  cancelUrl?: unknown
}

function resolveReturnUrlBase(): string {
  const configured = (process.env.STRIPE_RETURN_URL_BASE ?? process.env.PUBLIC_APP_URL ?? '').trim()
  if (configured) return configured.replace(/\/+$/, '')
  // Safe default for dev.
  return 'http://localhost:5173'
}

function isValidReturnUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Create a Stripe Checkout Session for a creator strategy feature.
 *
 * Idempotency: if the creator already has a `pending` or `active`
 * activation for the feature, we return 409 rather than letting Stripe
 * create a duplicate session. The creator should resume their existing
 * session or contact support.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!isStripeConfigured()) {
    return res
      .status(503)
      .json({ success: false, error: 'Stripe payment path is not enabled' } satisfies ApiEnvelope<never>)
  }

  const sessionAddressRaw = getSessionAddress(req)
  if (!sessionAddressRaw) {
    return res
      .status(401)
      .json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  const sessionAddress = getAddress(sessionAddressRaw as Address)

  const limiter = checkRateLimit(
    rateLimitKey('creator-strategy-stripe-checkout', sessionAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res
      .status(429)
      .json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: REQUEST_BODY_MAX_BYTES })
  const body = (bodyRaw && typeof bodyRaw === 'object' ? bodyRaw : {}) as CheckoutBody

  const creatorTokenRaw = typeof body.creatorToken === 'string' ? body.creatorToken.trim() : ''
  if (!isAddress(creatorTokenRaw)) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid creatorToken' } satisfies ApiEnvelope<never>)
  }
  const creatorToken = getAddress(creatorTokenRaw as Address)

  const featureKey = typeof body.featureKey === 'string' ? body.featureKey.trim() : ''
  const retiredMessage = getRetiredCreatorStrategyFeatureMessage(featureKey)
  if (retiredMessage) {
    return res
      .status(410)
      .json({ success: false, error: retiredMessage } satisfies ApiEnvelope<never>)
  }
  const feature = getCreatorStrategyFeature(featureKey)
  if (!feature) {
    return res
      .status(400)
      .json({ success: false, error: `Unknown featureKey "${featureKey}"` } satisfies ApiEnvelope<never>)
  }
  const alacarteBlocked = getAlacarteDeployPurchaseBlockedMessage(featureKey)
  if (alacarteBlocked) {
    return res
      .status(410)
      .json({ success: false, error: alacarteBlocked } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res
      .status(503)
      .json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res
      .status(503)
      .json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  const override = await findActivePriceOverride(db as any, {
    creatorToken,
    walletAddress: sessionAddress,
    featureKey: feature.key,
  })
  const pricing = applyPriceOverride(feature.priceUsdc, override)

  if (pricing.effectivePriceUsdc <= 0n) {
    return res.status(400).json({
      success: false,
      error: 'Free activations must use the on-chain path (zero-amount Stripe sessions are rejected)',
    } satisfies ApiEnvelope<never>)
  }

  const base = resolveReturnUrlBase()
  const successUrl = isValidReturnUrl(body.successUrl)
    ? (body.successUrl as string)
    : `${base}/creator/strategy/activation-success?creator=${creatorToken}&feature=${feature.key}&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = isValidReturnUrl(body.cancelUrl)
    ? (body.cancelUrl as string)
    : `${base}/creator/strategy/activation-cancelled?creator=${creatorToken}&feature=${feature.key}`

  let session
  try {
    session = await createCheckoutSession({
      creatorToken: creatorToken as `0x${string}`,
      walletAddress: sessionAddress as `0x${string}`,
      featureKey: feature.key,
      featureDisplayName: feature.displayName,
      featureDescription: feature.tagline,
      priceUsdc: pricing.effectivePriceUsdc,
      successUrl,
      cancelUrl,
      clientReferenceId: sessionAddress.toLowerCase(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(502).json({
      success: false,
      error: `Stripe checkout session creation failed: ${message}`,
    } satisfies ApiEnvelope<never>)
  }

  const insertResult = await insertStripeCheckoutActivation(db as any, {
    creatorToken,
    featureKey: feature.key,
    priceUsdcExpected: pricing.effectivePriceUsdc,
    walletAddress: sessionAddress,
    stripeCheckoutSessionId: session.sessionId,
    metadata: {
      sessionAddress,
      provisionerTag: feature.provisionerTag,
      paymentSource: 'stripe',
      catalogPriceUsdc: feature.priceUsdc.toString(),
      effectivePriceUsdc: pricing.effectivePriceUsdc.toString(),
      priceOverrideId: pricing.appliedOverrideId,
      discountBps: pricing.discountBps,
      stripeUnitAmountCents: session.unitAmountCents,
    },
  })

  if (!insertResult.ok) {
    // If the DB insert failed, we already paid to create a Stripe
    // session. Log it for operator reconciliation and return the error.
    console.error('[stripe-checkout] DB insert failed after creating Stripe session', {
      reason: insertResult.reason,
      message: insertResult.message,
      stripeSessionId: session.sessionId,
      creatorToken,
      featureKey: feature.key,
    })
    const statusByReason: Record<string, number> = {
      live_activation_exists: 409,
      db_error: 500,
    }
    const status = statusByReason[insertResult.reason] ?? 500
    return res.status(status).json({
      success: false,
      error: `Activation insert failed (${insertResult.reason}): ${insertResult.message}`,
    } satisfies ApiEnvelope<never>)
  }

  try {
    await upsertPaymentOrder({
      db: db as any,
      orderId: `activation:${insertResult.row.id}`,
      status: 'payment_pending',
      amountAtomic: pricing.effectivePriceUsdc,
      currency: 'USDC',
      metadata: {
        provider: 'stripe',
        stripeSessionId: session.sessionId,
        creatorToken,
        featureKey: feature.key,
      },
    })
  } catch (error) {
    console.warn('[stripe-checkout] payment order upsert failed', {
      activationId: insertResult.row.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return res.status(200).json({
    success: true,
    data: {
      sessionId: session.sessionId,
      sessionUrl: session.sessionUrl,
      unitAmountCents: session.unitAmountCents,
      featureKey: feature.key,
      priceUsdc: feature.priceUsdc.toString(),
      effectivePriceUsdc: pricing.effectivePriceUsdc.toString(),
      discountBps: pricing.discountBps,
      priceOverrideId: pricing.appliedOverrideId,
    },
  } satisfies ApiEnvelope<{
    sessionId: string
    sessionUrl: string
    unitAmountCents: number
    featureKey: string
    priceUsdc: string
    effectivePriceUsdc: string
    discountBps: number | null
    priceOverrideId: number | null
  }>)
}
