import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address, type Hex } from 'viem'

import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  getDb,
  getSessionAddress,
  handleOptions,
  isDbConfigured,
  rateLimitKey,
  RATE_LIMITS,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import {
  ETHOS_PAID_REFRESH_PRICE_USDC,
  getEthosPaidRefreshCooldown,
  insertCreatorEthosRefreshOrder,
  runPaidCreatorEthosRefresh,
} from '../../../../server/_lib/creatorEthos/paidRefresh.js'
import { loadCreatorEthosProjectionByAddresses } from '../../../../server/_lib/zora/creatorEthosProjection.js'
import {
  BASE_USDC_ADDRESS,
  resolveProtocolTreasuryForUsdcPayments,
  verifyUsdcPayment,
} from '../../../../server/_lib/creatorStrategy/usdcPayment.js'

const REQUEST_BODY_MAX_BYTES = 4_096

type RefreshRequestBody = {
  creatorAddress?: unknown
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
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const sessionAddressRaw = getSessionAddress(req)
  if (!sessionAddressRaw) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  const sessionAddress = getAddress(sessionAddressRaw as Address)

  const limiter = checkRateLimit(
    rateLimitKey('creator-ethos-refresh', sessionAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.creatorQuickstart,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: REQUEST_BODY_MAX_BYTES })
  const body = (bodyRaw && typeof bodyRaw === 'object' ? bodyRaw : {}) as RefreshRequestBody

  const creatorAddressRaw = typeof body.creatorAddress === 'string' ? body.creatorAddress.trim() : ''
  if (!isAddress(creatorAddressRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid creatorAddress' } satisfies ApiEnvelope<never>)
  }
  const creatorAddress = getAddress(creatorAddressRaw as Address).toLowerCase()

  const paymentTxHashRaw = typeof body.paymentTxHash === 'string' ? body.paymentTxHash.trim() : ''
  if (!isTxHash(paymentTxHashRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid paymentTxHash' } satisfies ApiEnvelope<never>)
  }
  const paymentTxHash = paymentTxHashRaw.toLowerCase() as Hex

  const cooldown = await getEthosPaidRefreshCooldown({ db, creatorAddress })
  if (cooldown.inCooldown) {
    res.setHeader('Retry-After', String(cooldown.retryAfterSeconds ?? 60))
    return res.status(429).json({
      success: false,
      error: `Creator refresh is on cooldown. Try again in ${cooldown.retryAfterSeconds ?? 60}s.`,
    } satisfies ApiEnvelope<never>)
  }

  const treasury = resolveProtocolTreasuryForUsdcPayments()
  const verification = await verifyUsdcPayment({
    txHash: paymentTxHash,
    expectedFrom: sessionAddress,
    expectedTo: treasury,
    minAmount: ETHOS_PAID_REFRESH_PRICE_USDC,
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

  const beforeRow = (await loadCreatorEthosProjectionByAddresses(db, [creatorAddress])).get(creatorAddress)
  const ethosScoreBefore = beforeRow?.score ?? null

  const refresh = await runPaidCreatorEthosRefresh(db, creatorAddress)
  if (!refresh.ok) {
    const statusByReason: Record<string, number> = {
      creator_not_indexed: 404,
      projection_unavailable: 503,
      ethos_sync_failed: 503,
    }
    return res.status(statusByReason[refresh.reason] ?? 500).json({
      success: false,
      error: refresh.message,
    } satisfies ApiEnvelope<never>)
  }

  const order = await insertCreatorEthosRefreshOrder({
    db,
    creatorAddress,
    coinAddress: refresh.coinAddress,
    payerAddress: sessionAddress,
    priceUsdcPaid: verification.value,
    paymentTxHash: verification.txHash,
    paymentTo: verification.to,
    ethosScoreBefore,
    ethosScoreAfter: refresh.ethosScore,
  })
  if (!order.ok) {
    const statusByReason: Record<string, number> = {
      payment_already_used: 409,
      db_error: 500,
    }
    return res.status(statusByReason[order.reason] ?? 500).json({
      success: false,
      error: order.message,
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      creatorAddress,
      coinAddress: refresh.coinAddress,
      ethosScoreBefore,
      ethosScore: refresh.ethosScore,
      ethosLevel: refresh.ethosLevel,
      ethosScoreSource: refresh.ethosScoreSource,
      paymentTxHash: verification.txHash,
      priceUsdcPaid: verification.value.toString(),
    },
  })
}
