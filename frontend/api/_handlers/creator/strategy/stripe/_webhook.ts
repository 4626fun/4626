import type { VercelRequest, VercelResponse } from '@vercel/node'
import type Stripe from 'stripe'

import {
  type ApiEnvelope,
  setNoStore,
  getDb,
  isDbConfigured,
  runInTransaction,
} from '@4626/server-core'
import { getAddress } from 'viem'

import { finalizeStripeCheckoutActivation } from '../../../../../server/_lib/creatorStrategy/activations.js'
import { recordPaymentEvent } from '../../../../../server/_lib/creatorStrategy/paymentLedger.js'
import { upsertPaymentOrder } from '../../../../../server/_lib/creatorStrategy/paymentOrders.js'
import {
  recordPaymentActivationQueued,
  recordPaymentProvisioningDispatch,
  type RecordPaymentActivationQueuedResult,
} from '../../../../../server/_lib/controlPlane/paymentControlPlane.js'
import { dispatchProvisioning } from '../../../../../server/_lib/creatorStrategy/provisioner.js'
import {
  isStripeWebhookConfigured,
  verifyStripeWebhook,
} from '../../../../../server/_lib/creatorStrategy/stripe.js'

/**
 * Stripe webhook handler.
 *
 * Reads the raw request body, verifies the `stripe-signature` header
 * against `STRIPE_WEBHOOK_SECRET`, then processes
 * `checkout.session.completed` events by finalizing the matching
 * `creator_strategy_features` row. The row moves from its
 * "`pending` (payment source=stripe, `payment_verified_at = NULL`)"
 * creation state to "`pending` (payment_verified_at set,
 * stripe_payment_intent_id populated)" — operator provisioning then
 * moves it to `active`.
 *
 * We DO NOT use the redirect return URL for activation — Stripe's
 * standard guidance is that webhooks are the source of truth (redirects
 * can be missed if the user closes the tab).
 *
 * Idempotency: Stripe may redeliver the same event. Our handler reads
 * by session id and issues an UPDATE, so replays are no-ops.
 *
 * Note on body parsing: Stripe webhook verification needs the raw
 * bytes. Vercel Node handlers by default give us a parsed JSON object
 * in `req.body`. We re-serialize to a string for verification. This
 * works in most cases but is technically fragile. A cleaner future
 * refactor would disable body parsing for this route specifically via
 * `config.api.bodyParser = false` in a Next.js API route, or by reading
 * the raw stream. For now this is adequate.
 */
export const config = {
  api: {
    bodyParser: false,
  },
} as const

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  // If Vercel has already parsed it into an object, reconstruct as JSON.
  // This is a fallback — in the ideal setup `bodyParser: false` (above)
  // keeps it raw. We handle both for robustness.
  const anyReq = req as unknown as {
    on: (event: string, cb: (chunk: Buffer) => void) => unknown
    body?: unknown
  }
  if (anyReq.body && typeof anyReq.body === 'object' && !(anyReq.body instanceof Buffer)) {
    return Buffer.from(JSON.stringify(anyReq.body), 'utf8')
  }
  if (anyReq.body && anyReq.body instanceof Buffer) {
    return anyReq.body
  }
  const chunks: Buffer[] = []
  const nodeReq = anyReq as unknown as {
    on: (event: 'data' | 'end' | 'error', cb: (arg?: unknown) => void) => unknown
  }
  await new Promise<void>((resolve, reject) => {
    nodeReq.on('data', (chunk) => chunks.push(Buffer.from(chunk as Buffer)))
    nodeReq.on('end', () => resolve())
    nodeReq.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))))
  })
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!isStripeWebhookConfigured()) {
    return res
      .status(503)
      .json({ success: false, error: 'Stripe webhook path is not enabled' } satisfies ApiEnvelope<never>)
  }

  const signature = req.headers['stripe-signature']
  const signatureStr = Array.isArray(signature) ? signature[0] : signature

  const rawBody = await readRawBody(req)

  const verification = await verifyStripeWebhook(rawBody, signatureStr)
  if (!verification.ok) {
    return res.status(400).json({
      success: false,
      error: `Webhook verification failed (${verification.reason}): ${verification.message}`,
    } satisfies ApiEnvelope<never>)
  }

  const event = verification.event

  // Only one event type drives activation. Other events get 200-acked
  // and ignored so Stripe doesn't retry.
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ success: true, data: { ignored: event.type } })
  }

  const session = event.data.object as Stripe.Checkout.Session

  if (session.payment_status !== 'paid') {
    console.warn('[stripe-webhook] checkout.session.completed with non-paid status', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
    })
    return res.status(200).json({ success: true, data: { skipped: 'not_paid' } })
  }

  const walletRaw = (session.metadata?.wallet_address ?? '').trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(walletRaw)) {
    return res.status(400).json({
      success: false,
      error: `Checkout session ${session.id} has invalid wallet_address metadata`,
    } satisfies ApiEnvelope<never>)
  }
  const walletAddress = getAddress(walletRaw as `0x${string}`)

  // Amount paid in USD cents → USDC base units (6 decimals).
  const unitAmountCents = session.amount_total ?? 0
  const priceUsdcPaid = BigInt(unitAmountCents) * 10_000n

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

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null
  // Stripe no longer exposes `charge` directly on the session; we store
  // the payment_intent_id here and let operators retrieve the charge id
  // from Stripe when needed.
  const stripeChargeId: string | null = null

  const persistedWebhook = await (async () => {
    try {
      return await runInTransaction(async (txDb) => {
        const finalize = await finalizeStripeCheckoutActivation(txDb as any, {
          stripeCheckoutSessionId: session.id,
          priceUsdcPaid,
          walletAddress,
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId,
          paymentVerifiedAt: new Date(event.created * 1000),
        })
        if (!finalize.ok) return { ok: false as const, finalize }

        await upsertPaymentOrder({
          db: txDb as any,
          orderId: `activation:${finalize.row.id}`,
          status: 'provisioning_queued',
          amountAtomic: priceUsdcPaid,
          currency: 'USDC',
          metadata: {
            provider: 'stripe',
            eventId: event.id,
            sessionId: session.id,
          },
        })
        await recordPaymentEvent({
          db: txDb as any,
          provider: 'stripe',
          providerEventId: event.id,
          orderId: `activation:${finalize.row.id}`,
          eventType: event.type,
          amountAtomic: priceUsdcPaid,
          currency: 'USDC',
          payload: {
            sessionId: session.id,
            paymentIntentId,
            creatorToken: finalize.row.creatorToken,
            featureKey: finalize.row.featureKey,
          },
        })
        return { ok: true as const, row: finalize.row }
      })
    } catch (error) {
      return {
        ok: false as const,
        reason: 'db_error' as const,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })()

  if (!persistedWebhook) {
    return res
      .status(503)
      .json({ success: false, error: 'Webhook persistence unavailable' } satisfies ApiEnvelope<never>)
  }

  if (!persistedWebhook.ok && 'finalize' in persistedWebhook) {
    console.error('[stripe-webhook] finalize failed', {
      sessionId: session.id,
      reason: persistedWebhook.finalize.reason,
      message: persistedWebhook.finalize.message,
    })
    const statusByReason: Record<string, number> = {
      session_not_found: 404,
      db_error: 500,
    }
    const status = statusByReason[persistedWebhook.finalize.reason] ?? 500
    return res.status(status).json({
      success: false,
      error: `Webhook finalize failed (${persistedWebhook.finalize.reason}): ${persistedWebhook.finalize.message}`,
    } satisfies ApiEnvelope<never>)
  }
  if (!persistedWebhook.ok) {
    return res.status(500).json({
      success: false,
      error: `Webhook persistence failed (${persistedWebhook.reason}): ${persistedWebhook.message}`,
    } satisfies ApiEnvelope<never>)
  }
  const activationRow = persistedWebhook.row

  let paymentControlPlane: RecordPaymentActivationQueuedResult | null = null
  try {
    paymentControlPlane = await recordPaymentActivationQueued({
      orderId: `activation:${activationRow.id}`,
      activationId: activationRow.id,
      provider: 'stripe',
      providerEventId: event.id,
      creatorToken: activationRow.creatorToken,
      featureKey: activationRow.featureKey,
      paymentSource: 'stripe',
      amountAtomic: priceUsdcPaid,
      currency: 'USDC',
      metadata: { sessionId: session.id, paymentIntentId },
    })
  } catch (error) {
    console.warn('[stripe-webhook] control-plane activation queue write failed', {
      eventId: event.id,
      activationId: activationRow.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Payment is verified and the row is in `pending`. Kick the
  // provisioning dispatcher. For v1 this only logs intent + returns
  // `enqueued`; operator still runs the provisioning script manually.
  // Non-fatal: if dispatch fails we still return 200 to Stripe so the
  // webhook isn't retried — the row's `pending` state is the source of
  // truth and operators poll from there.
  let provisionerNote: string | null = null
  let provisionOk = false
  try {
    const provision = await dispatchProvisioning({
      creatorToken: activationRow.creatorToken,
      featureKey: activationRow.featureKey,
      activationId: activationRow.id,
      paymentSource: 'stripe',
      paymentRef: paymentIntentId ?? session.id,
    })
    provisionOk = provision.ok
    if (provision.ok) {
      provisionerNote = provision.note
    } else {
      provisionerNote = `dispatch failed: ${provision.reason}`
      console.warn('[stripe-webhook] provisioning dispatch returned error', {
        sessionId: session.id,
        activationId: activationRow.id,
        reason: provision.reason,
        message: provision.message,
      })
    }
  } catch (error) {
    provisionerNote = `dispatch threw: ${error instanceof Error ? error.message : String(error)}`
    console.error('[stripe-webhook] provisioning dispatch crashed', {
      sessionId: session.id,
      activationId: activationRow.id,
      error,
    })
  }

  if (paymentControlPlane?.stageId) {
    try {
      await recordPaymentProvisioningDispatch({
        operationId: paymentControlPlane.operationId,
        stageId: paymentControlPlane.stageId,
        ok: provisionOk,
        note: provisionerNote ?? 'dispatch completed',
      })
    } catch (error) {
      console.warn('[stripe-webhook] control-plane dispatch tracking failed', {
        operationId: paymentControlPlane.operationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      eventId: event.id,
      eventType: event.type,
      activationId: activationRow.id,
      sessionId: session.id,
      provisionerNote,
    },
  } satisfies ApiEnvelope<{
    eventId: string
    eventType: string
    activationId: number
    sessionId: string
    provisionerNote: string | null
  }>)
}
