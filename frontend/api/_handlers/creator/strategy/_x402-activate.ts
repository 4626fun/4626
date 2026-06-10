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
  runInTransaction,
} from '@4626/server-core'
import { getAddress, isAddress, type Address, type Hex } from 'viem'

import {
  getCreatorStrategyFeature,
  getRetiredCreatorStrategyFeatureMessage,
} from '../../../../server/_lib/creatorStrategy/catalog.js'
import { getAlacarteDeployPurchaseBlockedMessage } from '../../../../server/_lib/creatorStrategy/bundleEntitlements.js'
import {
  hasAnyLiveActivationRow,
  insertPendingActivation,
  toCreatorStrategyFeatureDto as toActivationDto,
} from '../../../../server/_lib/creatorStrategy/activations.js'
import {
  BASE_USDC_ADDRESS,
  resolveProtocolTreasuryForUsdcPayments,
} from '../../../../server/_lib/creatorStrategy/usdcPayment.js'
import {
  applyPriceOverride,
  findActivePriceOverride,
} from '../../../../server/_lib/creatorStrategy/priceOverrides.js'
import {
  buildPaymentRequirements,
  parseXPaymentHeader,
  settleX402Payment,
  validateX402Authorization,
} from '../../../../server/_lib/creatorStrategy/x402.js'
import { dispatchProvisioning } from '../../../../server/_lib/creatorStrategy/provisioner.js'
import { recordPaymentEvent } from '../../../../server/_lib/creatorStrategy/paymentLedger.js'
import { upsertPaymentOrder } from '../../../../server/_lib/creatorStrategy/paymentOrders.js'
import {
  recordPaymentActivationQueued,
  recordPaymentProvisioningDispatch,
  type RecordPaymentActivationQueuedResult,
} from '../../../../server/_lib/controlPlane/paymentControlPlane.js'

const REQUEST_BODY_MAX_BYTES = 4_096

type ActivateRequestBody = {
  creatorToken?: unknown
  featureKey?: unknown
}

/**
 * Durably record a settled-on-chain x402 payment whose activation
 * persistence failed. Runs OUTSIDE the (rolled back) activation
 * transaction so the on-chain USDC move always has a DB trail for
 * refund / manual-review ops. Idempotent via the payment_events
 * `(provider, provider_event_id)` unique index. Never throws — a
 * failure here must not mask the original error response.
 */
async function recordOrphanedX402Settlement(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows?: any[] }> }
  settlement: { txHash: Hex; value: bigint; from: Address; to: Address; blockNumber: bigint }
  creatorToken: Address
  featureKey: string
  failureReason: string
  failureMessage: string
}): Promise<void> {
  const orderId = `orphaned-x402:${params.settlement.txHash}`
  try {
    await upsertPaymentOrder({
      db: params.db,
      orderId,
      status: 'manual_review',
      amountAtomic: params.settlement.value,
      currency: 'USDC',
      metadata: {
        provider: 'x402',
        txHash: params.settlement.txHash,
        creatorToken: params.creatorToken,
        featureKey: params.featureKey,
        orphanReason: params.failureReason,
      },
    })
    await recordPaymentEvent({
      db: params.db,
      provider: 'x402',
      providerEventId: params.settlement.txHash,
      orderId,
      eventType: 'x402.settlement_orphaned',
      amountAtomic: params.settlement.value,
      currency: 'USDC',
      payload: {
        creatorToken: params.creatorToken,
        featureKey: params.featureKey,
        from: params.settlement.from,
        to: params.settlement.to,
        blockNumber: params.settlement.blockNumber.toString(),
        failureReason: params.failureReason,
        failureMessage: params.failureMessage,
      },
    })
  } catch (error) {
    console.error('[creator-strategy/x402] failed to record orphaned settlement', {
      txHash: params.settlement.txHash,
      creatorToken: params.creatorToken,
      featureKey: params.featureKey,
      failureReason: params.failureReason,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * x402-style activation for creator strategy features.
 *
 * Flow:
 *   1. Client POSTs `{ creatorToken, featureKey }` WITHOUT a payment tx.
 *   2. If no `X-PAYMENT` header is present, server responds 402 with
 *      `accepts` describing the USDC amount + destination + network.
 *   3. Client signs an EIP-3009 `transferWithAuthorization` in-wallet,
 *      base64-encodes `{ scheme, network, x402_version, payload }` into
 *      `X-PAYMENT`, and re-POSTs the same body.
 *   4. Server validates the authorization statically, then broadcasts
 *      the settled `transferWithAuthorization` via the server's relayer
 *      key (`X402_RELAYER_PRIVATE_KEY` or fallback `PRIVATE_KEY`). The
 *      relayer pays Base gas so the creator doesn't need ETH.
 *   5. On success the activation row is created with
 *      `payment_source = 'x402_base'` and the settled tx hash is stored
 *      in `payment_tx_hash`, enabling all downstream flows (paywall gate,
 *      verifier, dedupe) to work uniformly.
 *
 * The original `/api/creator/strategy/activate` endpoint keeps working
 * unchanged for wallets that can't do EIP-3009 and prefer the legacy
 * "send a tx, paste the hash" flow.
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

  const sessionAddressRaw = getSessionAddress(req)
  if (!sessionAddressRaw) {
    return res
      .status(401)
      .json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  const sessionAddress = getAddress(sessionAddressRaw as Address)

  const limiter = checkRateLimit(
    rateLimitKey('creator-strategy-x402', sessionAddress.toLowerCase(), getClientIp(req)),
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

  // Resolve effective price (respects discount overrides) before
  // building the 402 requirement or settling.
  const override = await findActivePriceOverride(db as any, {
    creatorToken,
    walletAddress: sessionAddress,
    featureKey: feature.key,
  })
  const pricing = applyPriceOverride(feature.priceUsdc, override)
  const treasury = resolveProtocolTreasuryForUsdcPayments()

  // Entitlement pre-check BEFORE any irreversible action. The server (not
  // the user) broadcasts the EIP-3009 settlement below, so settling first and
  // letting `insertPendingActivation` 409 afterwards would move real USDC
  // with no ledger row. Mirrors the `one_live_per_feature` unique index.
  const alreadyLive = await hasAnyLiveActivationRow(db as any, {
    creatorToken,
    featureKey: feature.key,
  })
  if (alreadyLive) {
    return res.status(409).json({
      success: false,
      error: 'activation_insert_failed',
      reason: 'live_activation_exists',
      message: 'A pending or active activation already exists for this creator and feature',
    } satisfies ApiEnvelope<never>)
  }

  const paymentHeader = req.headers['x-payment']
  const paymentHeaderStr = Array.isArray(paymentHeader) ? paymentHeader[0] : paymentHeader

  // ─── 402 path: no X-PAYMENT header → tell the client what to sign. ───
  if (!paymentHeaderStr) {
    const requirements = buildPaymentRequirements({
      payTo: treasury,
      maxAmountRequired: pricing.effectivePriceUsdc,
      description: `Activate ${feature.displayName} on ${creatorToken}`,
      resource: `/api/creator/strategy/x402-activate`,
    })
    return res.status(402).json(requirements)
  }

  // ─── X-PAYMENT present: parse, validate, settle. ───
  const parsed = parseXPaymentHeader(paymentHeaderStr)
  if (!parsed.ok) {
    return res.status(400).json({
      success: false,
      error: 'x402_header_parse_failed',
      reason: parsed.reason,
    } satisfies ApiEnvelope<never>)
  }

  const staticValidation = validateX402Authorization({
    payment: parsed.payment,
    expectedFrom: sessionAddress,
    expectedTo: treasury,
    minAmount: pricing.effectivePriceUsdc,
  })
  if (!staticValidation.ok) {
    return res.status(400).json({
      success: false,
      error: 'x402_authorization_invalid',
      reason: staticValidation.reason,
    } satisfies ApiEnvelope<never>)
  }

  const settlement = await settleX402Payment(parsed.payment)
  if (!settlement.ok) {
    const statusByReason: Record<string, number> = {
      x402_relayer_not_configured: 503,
      x402_settlement_reverted: 409,
      x402_rpc_error: 503,
      x402_transfer_not_found: 500,
    }
    const status = statusByReason[settlement.reason] ?? 500
    return res.status(status).json({
      success: false,
      error: 'x402_settlement_failed',
      reason: settlement.reason,
      message: settlement.message,
    } satisfies ApiEnvelope<never>)
  }

  const persistedActivation = await (async () => {
    try {
      return await runInTransaction(async (txDb) => {
        const insertResult = await insertPendingActivation(txDb as any, {
          creatorToken,
          featureKey: feature.key,
          priceUsdcPaid: settlement.value,
          paymentTxHash: settlement.txHash,
          paymentFrom: settlement.from,
          paymentTo: settlement.to,
          paymentVerifiedAt: new Date(),
          status: 'pending',
          metadata: {
            sessionAddress,
            provisionerTag: feature.provisionerTag,
            blockNumber: settlement.blockNumber.toString(),
            paymentSource: 'x402_base',
            x402Nonce: parsed.payment.payload.authorization.nonce,
            catalogPriceUsdc: feature.priceUsdc.toString(),
            effectivePriceUsdc: pricing.effectivePriceUsdc.toString(),
            priceOverrideId: pricing.appliedOverrideId,
            discountBps: pricing.discountBps,
          },
        })
        if (!insertResult.ok) return { ok: false as const, insertResult }

        await upsertPaymentOrder({
          db: txDb as any,
          orderId: `activation:${insertResult.row.id}`,
          status: 'provisioning_queued',
          amountAtomic: settlement.value,
          currency: 'USDC',
          metadata: {
            provider: 'x402',
            txHash: settlement.txHash,
            creatorToken,
            featureKey: feature.key,
          },
        })
        await recordPaymentEvent({
          db: txDb as any,
          provider: 'x402',
          providerEventId: settlement.txHash,
          orderId: `activation:${insertResult.row.id}`,
          eventType: 'x402.authorization_settled',
          amountAtomic: settlement.value,
          currency: 'USDC',
          payload: {
            creatorToken,
            featureKey: feature.key,
            treasury,
            blockNumber: settlement.blockNumber.toString(),
          },
        })
        return { ok: true as const, row: insertResult.row }
      })
    } catch (error) {
      return {
        ok: false as const,
        reason: 'db_error' as const,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })()

  if (!persistedActivation) {
    await recordOrphanedX402Settlement({
      db: db as any,
      settlement,
      creatorToken,
      featureKey: feature.key,
      failureReason: 'persistence_unavailable',
      failureMessage: 'runInTransaction returned null (no DB)',
    })
    return res
      .status(503)
      .json({ success: false, error: 'Activation persistence unavailable' } satisfies ApiEnvelope<never>)
  }

  if (!persistedActivation.ok && 'insertResult' in persistedActivation) {
    await recordOrphanedX402Settlement({
      db: db as any,
      settlement,
      creatorToken,
      featureKey: feature.key,
      failureReason: persistedActivation.insertResult.reason,
      failureMessage: persistedActivation.insertResult.message,
    })
    const statusByReason: Record<string, number> = {
      live_activation_exists: 409,
      payment_already_used: 409,
      db_error: 500,
    }
    const status = statusByReason[persistedActivation.insertResult.reason] ?? 500
    return res.status(status).json({
      success: false,
      error: 'activation_insert_failed',
      reason: persistedActivation.insertResult.reason,
      message: persistedActivation.insertResult.message,
    } satisfies ApiEnvelope<never>)
  }

  if (!persistedActivation.ok) {
    await recordOrphanedX402Settlement({
      db: db as any,
      settlement,
      creatorToken,
      featureKey: feature.key,
      failureReason: persistedActivation.reason,
      failureMessage: persistedActivation.message,
    })
    return res.status(500).json({
      success: false,
      error: `Activation persistence failed (${persistedActivation.reason}): ${persistedActivation.message}`,
    } satisfies ApiEnvelope<never>)
  }
  const activationRow = persistedActivation.row

  let paymentControlPlane: RecordPaymentActivationQueuedResult | null = null
  try {
    paymentControlPlane = await recordPaymentActivationQueued({
      orderId: `activation:${activationRow.id}`,
      activationId: activationRow.id,
      provider: 'x402',
      providerEventId: settlement.txHash,
      creatorToken,
      featureKey: feature.key,
      paymentSource: 'x402_base',
      amountAtomic: settlement.value,
      currency: 'USDC',
      requestedBy: sessionAddress,
      metadata: { txHash: settlement.txHash },
    })
  } catch (error) {
    console.warn('[creator-strategy/x402] control-plane activation queue write failed', {
      txHash: settlement.txHash,
      activationId: activationRow.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  let provisionerNote: string | null = null
  let provisionOk = false
  try {
    const provision = await dispatchProvisioning({
      creatorToken,
      featureKey: feature.key,
      activationId: activationRow.id,
      paymentSource: 'x402_base',
      paymentRef: settlement.txHash,
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
      console.warn('[creator-strategy/x402] control-plane dispatch tracking failed', {
        operationId: paymentControlPlane.operationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      activation: toActivationDto(activationRow),
      featureKey: feature.key,
      paymentSource: 'x402_base' as const,
      priceUsdc: feature.priceUsdc.toString(),
      effectivePriceUsdc: pricing.effectivePriceUsdc.toString(),
      discountBps: pricing.discountBps,
      priceOverrideId: pricing.appliedOverrideId,
      treasury,
      x402: {
        txHash: settlement.txHash,
        usdcAddress: getAddress(BASE_USDC_ADDRESS),
      },
      provisionerNote,
    },
  } satisfies ApiEnvelope<{
    activation: ReturnType<typeof toActivationDto>
    featureKey: string
    paymentSource: 'x402_base'
    priceUsdc: string
    effectivePriceUsdc: string
    discountBps: number | null
    priceOverrideId: number | null
    treasury: Address
    x402: { txHash: Hex; usdcAddress: Address }
    provisionerNote: string | null
  }>)
}
