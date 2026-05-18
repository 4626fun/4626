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
} from '../../../../packages/server-core/src/index.js'
import { getAddress, isAddress, type Address, type Hex } from 'viem'

import { getCreatorStrategyFeature } from '../../../../server/_lib/creatorStrategy/catalog.js'
import {
  insertPendingActivation,
  toCreatorStrategyFeatureDto as toActivationDto,
} from '../../../../server/_lib/creatorStrategy/activations.js'
import {
  BASE_USDC_ADDRESS,
  resolveProtocolTreasuryForUsdcPayments,
  verifyUsdcPayment,
} from '../../../../server/_lib/creatorStrategy/usdcPayment.js'
import {
  applyPriceOverride,
  findActivePriceOverride,
} from '../../../../server/_lib/creatorStrategy/priceOverrides.js'
import { recordPaymentEvent } from '../../../../server/_lib/creatorStrategy/paymentLedger.js'
import { upsertPaymentOrder } from '../../../../server/_lib/creatorStrategy/paymentOrders.js'
import {
  recordPaymentActivationQueued,
  recordPaymentProvisioningDispatch,
  type RecordPaymentActivationQueuedResult,
} from '../../../../server/_lib/controlPlane/paymentControlPlane.js'
import { dispatchProvisioning } from '../../../../server/_lib/creatorStrategy/provisioner.js'

const REQUEST_BODY_MAX_BYTES = 4_096

type ActivateRequestBody = {
  creatorToken?: unknown
  featureKey?: unknown
  paymentTxHash?: unknown
}

function isTxHash(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionAddressRaw = getSessionAddress(req)
  if (!sessionAddressRaw) {
    return res
      .status(401)
      .json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  const sessionAddress = getAddress(sessionAddressRaw as Address)

  const limiter = checkRateLimit(
    rateLimitKey('creator-strategy-activate', sessionAddress.toLowerCase(), getClientIp(req)),
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
  const body = (bodyRaw && typeof bodyRaw === 'object' ? bodyRaw : {}) as ActivateRequestBody

  const creatorTokenRaw = typeof body.creatorToken === 'string' ? body.creatorToken.trim() : ''
  if (!isAddress(creatorTokenRaw)) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid creatorToken' } satisfies ApiEnvelope<never>)
  }
  const creatorToken = getAddress(creatorTokenRaw as Address)

  const featureKey = typeof body.featureKey === 'string' ? body.featureKey.trim() : ''
  const feature = getCreatorStrategyFeature(featureKey)
  if (!feature) {
    return res
      .status(400)
      .json({ success: false, error: `Unknown featureKey "${featureKey}"` } satisfies ApiEnvelope<never>)
  }

  const paymentTxHashRaw = typeof body.paymentTxHash === 'string' ? body.paymentTxHash.trim() : ''
  if (!isTxHash(paymentTxHashRaw)) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid paymentTxHash' } satisfies ApiEnvelope<never>)
  }
  const paymentTxHash = paymentTxHashRaw.toLowerCase() as Hex

  // DB must be up BEFORE verification so we can look up any active price
  // override (partner comp, support credit, free promo) and clamp the
  // on-chain minAmount to `min(override, catalog)`. This means a
  // discounted creator paying $50 won't be rejected for "value below
  // minAmount=100". If the DB is down we fall back to catalog pricing —
  // safer than silently free-gating a feature.
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

  const treasury = resolveProtocolTreasuryForUsdcPayments()
  const verification = await verifyUsdcPayment({
    txHash: paymentTxHash,
    expectedFrom: sessionAddress,
    expectedTo: treasury,
    minAmount: pricing.effectivePriceUsdc,
    usdcAddress: BASE_USDC_ADDRESS,
  })
  if (!verification.ok) {
    const statusByReason: Record<string, number> = {
      tx_not_found: 404,
      tx_reverted: 409,
      transfer_not_found: 409,
      rpc_error: 503,
    }
    const status = statusByReason[verification.reason] ?? 500
    return res.status(status).json({
      success: false,
      error: `Payment verification failed (${verification.reason}): ${verification.message}`,
    } satisfies ApiEnvelope<never>)
  }

  const insertResult = await insertPendingActivation(db as any, {
    creatorToken,
    featureKey: feature.key,
    priceUsdcPaid: verification.value,
    paymentTxHash: verification.txHash,
    paymentFrom: verification.from,
    paymentTo: verification.to,
    paymentVerifiedAt: new Date(),
    status: 'pending',
    metadata: {
      sessionAddress,
      provisionerTag: feature.provisionerTag,
      blockNumber: verification.blockNumber.toString(),
      paymentSource: 'usdc_base',
      catalogPriceUsdc: feature.priceUsdc.toString(),
      effectivePriceUsdc: pricing.effectivePriceUsdc.toString(),
      priceOverrideId: pricing.appliedOverrideId,
      discountBps: pricing.discountBps,
    },
  })

  if (!insertResult.ok) {
    const statusByReason: Record<string, number> = {
      live_activation_exists: 409,
      payment_already_used: 409,
      db_error: 500,
    }
    const status = statusByReason[insertResult.reason] ?? 500
    return res.status(status).json({
      success: false,
      error: `Activation failed (${insertResult.reason}): ${insertResult.message}`,
    } satisfies ApiEnvelope<never>)
  }

  let paymentControlPlane: RecordPaymentActivationQueuedResult | null = null
  try {
    await upsertPaymentOrder({
      db: db as any,
      orderId: `activation:${insertResult.row.id}`,
      status: 'provisioning_queued',
      amountAtomic: verification.value,
      currency: 'USDC',
      metadata: {
        provider: 'usdc_base',
        txHash: verification.txHash,
        creatorToken,
        featureKey: feature.key,
      },
    })
    await recordPaymentEvent({
      db: db as any,
      provider: 'manual',
      providerEventId: verification.txHash,
      orderId: `activation:${insertResult.row.id}`,
      eventType: 'usdc.transfer_verified',
      amountAtomic: verification.value,
      currency: 'USDC',
      payload: {
        creatorToken,
        featureKey: feature.key,
        treasury,
        blockNumber: verification.blockNumber.toString(),
        paymentSource: 'usdc_base',
      },
    })
    paymentControlPlane = await recordPaymentActivationQueued({
      orderId: `activation:${insertResult.row.id}`,
      activationId: insertResult.row.id,
      provider: 'manual',
      providerEventId: verification.txHash,
      creatorToken,
      featureKey: feature.key,
      paymentSource: 'usdc_base',
      amountAtomic: verification.value,
      currency: 'USDC',
      requestedBy: sessionAddress,
      metadata: { txHash: verification.txHash },
    })
  } catch (error) {
    console.warn('[creator-strategy/activate] payment event ledger write failed', {
      txHash: verification.txHash,
      activationId: insertResult.row.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Kick the provisioning dispatcher (non-fatal). Operator picks up
  // the `pending` row and runs the feature-specific script regardless.
  let provisionerNote: string | null = null
  let provisionOk = false
  try {
    const provision = await dispatchProvisioning({
      creatorToken,
      featureKey: feature.key,
      activationId: insertResult.row.id,
      paymentSource: 'usdc_base',
      paymentRef: verification.txHash,
    })
    provisionOk = provision.ok
    provisionerNote = provision.ok ? provision.note : `dispatch failed: ${provision.reason}`
  } catch (error) {
    provisionerNote = `dispatch threw: ${error instanceof Error ? error.message : String(error)}`
  }

  if (paymentControlPlane?.stageId) {
    try {
      await recordPaymentProvisioningDispatch({
        operationId: paymentControlPlane.operationId,
        stageId: paymentControlPlane.stageId,
        ok: provisionOk,
        note: provisionerNote ?? 'dispatch completed',
        actor: sessionAddress,
      })
    } catch (error) {
      console.warn('[creator-strategy/activate] control-plane dispatch tracking failed', {
        operationId: paymentControlPlane.operationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      activation: toActivationDto(insertResult.row),
      featureKey: feature.key,
      priceUsdc: feature.priceUsdc.toString(),
      effectivePriceUsdc: pricing.effectivePriceUsdc.toString(),
      discountBps: pricing.discountBps,
      priceOverrideId: pricing.appliedOverrideId,
      treasury,
      estimatedActivationWindow: feature.estimatedActivationWindow,
      provisionerNote,
    },
  } satisfies ApiEnvelope<{
    activation: ReturnType<typeof toActivationDto>
    featureKey: string
    priceUsdc: string
    effectivePriceUsdc: string
    discountBps: number | null
    priceOverrideId: number | null
    treasury: Address
    estimatedActivationWindow: string
    provisionerNote: string | null
  }>)
}
