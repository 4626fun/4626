import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
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
import { getAddress, isAddress, type Address } from 'viem'

import {
  listCreatorStrategyFeaturesForPurchase,
  toCreatorStrategyFeatureDto as toCatalogDto,
} from '../../../../server/_lib/creatorStrategy/catalog.js'
import {
  listActivationsForCreator,
  toCreatorStrategyFeatureDto as toActivationDto,
} from '../../../../server/_lib/creatorStrategy/activations.js'
import { resolveProtocolTreasuryForUsdcPayments } from '../../../../server/_lib/creatorStrategy/usdcPayment.js'
import {
  resolveCreatorStrategyPlan,
  type ResolvedStrategyPlan,
} from '../../../../server/_lib/creatorStrategy/resolveWeights.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
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
    rateLimitKey('creator-strategy-list', sessionAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
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

  const creatorParam = typeof req.query.creator === 'string' ? req.query.creator.trim() : ''
  if (!isAddress(creatorParam)) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid creator address' } satisfies ApiEnvelope<never>)
  }
  const creatorToken = getAddress(creatorParam as Address)

  const catalog = listCreatorStrategyFeaturesForPurchase().map(toCatalogDto)
  const treasury = resolveProtocolTreasuryForUsdcPayments()

  let activations: ReturnType<typeof toActivationDto>[] = []
  let deployPlan: DeployPlanDto = NO_PAID_STRATEGIES_PLAN(creatorToken)
  if (isDbConfigured()) {
    try {
      const db = await getDb()
      if (db) {
        const rows = await listActivationsForCreator(db as any, creatorToken)
        activations = rows.map(toActivationDto)
        const planResult = await resolveCreatorStrategyPlan(db as any, creatorToken)
        deployPlan = toDeployPlanDto(planResult, creatorToken)
      }
    } catch (error) {
      // Non-fatal: catalog is still useful without activations / plan.
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[creator/strategy/list] Failed to load activations', { creatorToken, message })
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      creatorToken,
      treasury,
      catalog,
      activations,
      deployPlan,
    },
  } satisfies ApiEnvelope<{
    creatorToken: Address
    treasury: Address
    catalog: ReturnType<typeof toCatalogDto>[]
    activations: ReturnType<typeof toActivationDto>[]
    deployPlan: DeployPlanDto
  }>)
}

/**
 * Surface the resolved strategy plan as JSON. Bigints become strings so
 * client-side JSON parsing stays boring. Weights are in basis points
 * (10_000 = 100 %).
 *
 * When the creator has not paid for any strategy yet, we return a
 * `deployable: false` plan rather than a null. Clients should gate the
 * Deploy button on this flag and surface the `activateAtLeastOne`
 * message.
 */
type DeployPlanDto = {
  creatorToken: Address
  deployable: boolean
  charmWeightBps: string
  ajnaWeightBps: string
  solanaWeightBps: string
  idleReserveBps: string
  reasons: ResolvedStrategyPlan['reasons']
  activeFeatureKeys: ResolvedStrategyPlan['activeFeatureKeys']
  /** Present when `deployable` is false; explains what to do. */
  blockedReason: 'no_paid_strategies' | null
}

function NO_PAID_STRATEGIES_PLAN(creatorToken: Address): DeployPlanDto {
  return {
    creatorToken,
    deployable: false,
    charmWeightBps: '0',
    ajnaWeightBps: '0',
    solanaWeightBps: '0',
    idleReserveBps: '10000',
    reasons: { charm: 'unpaid', ajna: 'unpaid', solana: 'unpaid' },
    activeFeatureKeys: [],
    blockedReason: 'no_paid_strategies',
  }
}

function toDeployPlanDto(
  planResult: Awaited<ReturnType<typeof resolveCreatorStrategyPlan>>,
  creatorToken: Address,
): DeployPlanDto {
  if (!planResult.ok) {
    return {
      creatorToken,
      deployable: false,
      charmWeightBps: '0',
      ajnaWeightBps: '0',
      solanaWeightBps: '0',
      idleReserveBps: '10000',
      reasons: { charm: 'unpaid', ajna: 'unpaid', solana: 'unpaid' },
      activeFeatureKeys: planResult.activeFeatureKeys,
      blockedReason: 'no_paid_strategies',
    }
  }
  const { plan } = planResult
  return {
    creatorToken: plan.creatorToken,
    deployable: true,
    charmWeightBps: plan.charmWeightBps.toString(),
    ajnaWeightBps: plan.ajnaWeightBps.toString(),
    solanaWeightBps: plan.solanaWeightBps.toString(),
    idleReserveBps: plan.idleReserveBps.toString(),
    reasons: plan.reasons,
    activeFeatureKeys: plan.activeFeatureKeys,
    blockedReason: null,
  }
}
