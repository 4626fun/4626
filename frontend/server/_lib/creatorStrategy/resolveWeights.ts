/**
 * Resolve which Phase 3 strategy slots a creator has paid for.
 *
 * Reads active `creator_strategy_features` rows for the given creator
 * token and returns the Phase-3 weight pair the deploy session should
 * pass to `DeploymentBatcher.deployPhase3Strategies`. Strategies the
 * creator has not activated are returned with `weightBps = 0`, which the
 * patched `DeploymentBatcher` interprets as "skip this strategy
 * entirely" (no deploy, no addStrategy call, result address stays zero).
 *
 * Charm and Ajna are opt-in paid features. Solana vault strategy weight
 * is permanently zero — share mesh seeding happens via the fixed 30%
 * ShareOFT auto-bridge at finalizePhase2 instead of Phase-3 TVL.
 *
 * **At least one paid strategy is required** — the contract rejects a
 * weight sum of zero, and this resolver returns `ok: false` when
 * nothing is active so the deploy page can block submission until the
 * creator activates at least one feature.
 *
 * Weight scaling: paid strategies split a fixed productive budget
 * (`TOTAL_ALLOCATION_BPS - DEFAULT_IDLE_RESERVE_BPS` = `9_000` bps)
 * evenly, with the idle reserve fixed at `1_000` bps regardless of
 * strategy count. So:
 *   1 strategy : 9_000 bps → that strategy gets 90 %  (idle 10 %)
 *   2 strategies : 4_500 bps each → 45 % / 45 %        (idle 10 %)
 *
 * Note: the server-side deploy session is the AUTHORITATIVE enforcement
 * point for weight gating. A client that constructs a UserOp with
 * `charmWeightBps > 0` but no `charm_active_lp` activation must be
 * refused by the paymaster / deploy-continue handler using this
 * resolver's output as the truth.
 */

import type { Address } from 'viem'
import { getAddress } from 'viem'

import {
  DEPLOY_GATING_FEATURE_KEYS,
  type CreatorStrategyFeatureKey,
} from './catalog.js'
import { expandCreatorFeatureKeys } from './bundleEntitlements.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

/**
 * Fixed idle reserve in bps. Kept constant across strategy counts so
 * creators always have a predictable withdrawal buffer.
 */
export const DEFAULT_IDLE_RESERVE_BPS = 1_000n
export const TOTAL_ALLOCATION_BPS = 10_000n
export const PRODUCTIVE_ALLOCATION_BPS = TOTAL_ALLOCATION_BPS - DEFAULT_IDLE_RESERVE_BPS // 9_000

/** Default 45/45 split when both Charm and Ajna are paid. */
export const DEFAULT_CHARM_WEIGHT_BPS = PRODUCTIVE_ALLOCATION_BPS / 2n // 4_500
export const DEFAULT_AJNA_WEIGHT_BPS = PRODUCTIVE_ALLOCATION_BPS / 2n // 4_500
/** Solana vault strategy weight is always zero on greenfield deploys. */
export const DEFAULT_SOLANA_WEIGHT_BPS = 0n

export type StrategyWeights = {
  charmWeightBps: bigint
  ajnaWeightBps: bigint
  solanaWeightBps: bigint
  idleReserveBps: bigint
}

export type ResolvedStrategyPlan = StrategyWeights & {
  creatorToken: Address
  reasons: {
    charm: 'paid' | 'unpaid'
    ajna: 'paid' | 'unpaid'
    solana: 'share_auto_bridge'
  }
  activeFeatureKeys: CreatorStrategyFeatureKey[]
}

/**
 * Read which gated features the creator currently has active or pending
 * payment for. Both `pending` and `active` count as "paid".
 */
export async function readActiveCreatorFeatureKeys(
  db: Db,
  creatorToken: Address,
): Promise<Set<CreatorStrategyFeatureKey>> {
  const key = creatorToken.toLowerCase()
  const result = await db.sql`
    SELECT feature_key
    FROM creator_strategy_features
    WHERE creator_token = ${key}
      AND status IN ('pending', 'active')
  `
  const rawKeys: string[] = []
  for (const row of result.rows ?? []) {
    const raw = String(row.feature_key ?? '').trim()
    if (raw) rawKeys.push(raw)
  }
  return expandCreatorFeatureKeys(rawKeys)
}

export type ComputeStrategyWeightsResult =
  | { ok: true; weights: StrategyWeights }
  | { ok: false; reason: 'no_paid_strategies' }

export function computeStrategyWeights(
  activeKeys: ReadonlySet<CreatorStrategyFeatureKey>,
): ComputeStrategyWeightsResult {
  const charmPaid = activeKeys.has(DEPLOY_GATING_FEATURE_KEYS.charm)
  const ajnaPaid = activeKeys.has(DEPLOY_GATING_FEATURE_KEYS.ajna)
  const activeCount = BigInt((charmPaid ? 1 : 0) + (ajnaPaid ? 1 : 0))
  if (activeCount === 0n) return { ok: false, reason: 'no_paid_strategies' }

  const perStrategyBps = PRODUCTIVE_ALLOCATION_BPS / activeCount
  const charmWeightBps = charmPaid ? perStrategyBps : 0n
  const ajnaWeightBps = ajnaPaid ? perStrategyBps : 0n
  const solanaWeightBps = 0n
  const idleReserveBps = TOTAL_ALLOCATION_BPS - (charmWeightBps + ajnaWeightBps + solanaWeightBps)
  return {
    ok: true,
    weights: { charmWeightBps, ajnaWeightBps, solanaWeightBps, idleReserveBps },
  }
}

export type ResolveCreatorStrategyPlanResult =
  | { ok: true; plan: ResolvedStrategyPlan }
  | {
      ok: false
      reason: 'no_paid_strategies'
      creatorToken: Address
      activeFeatureKeys: CreatorStrategyFeatureKey[]
    }

export async function resolveCreatorStrategyPlan(
  db: Db,
  creatorTokenRaw: Address,
): Promise<ResolveCreatorStrategyPlanResult> {
  const creatorToken = getAddress(creatorTokenRaw)
  const active = await readActiveCreatorFeatureKeys(db, creatorToken)
  const weightResult = computeStrategyWeights(active)
  if (!weightResult.ok) {
    return {
      ok: false,
      reason: weightResult.reason,
      creatorToken,
      activeFeatureKeys: Array.from(active),
    }
  }
  return {
    ok: true,
    plan: {
      creatorToken,
      ...weightResult.weights,
      reasons: {
        charm: active.has(DEPLOY_GATING_FEATURE_KEYS.charm) ? 'paid' : 'unpaid',
        ajna: active.has(DEPLOY_GATING_FEATURE_KEYS.ajna) ? 'paid' : 'unpaid',
        solana: 'share_auto_bridge',
      },
      activeFeatureKeys: Array.from(active),
    },
  }
}

export type WeightGateResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'charm_unpaid_but_requested'
        | 'ajna_unpaid_but_requested'
        | 'solana_unpaid_but_requested'
        | 'charm_weight_mismatch'
        | 'ajna_weight_mismatch'
        | 'solana_weight_mismatch'
      expected: StrategyWeights
      requested: {
        charmWeightBps: bigint
        ajnaWeightBps: bigint
        solanaWeightBps: bigint
      }
    }

export function gateRequestedStrategyWeights(
  plan: ResolvedStrategyPlan,
  requested: {
    charmWeightBps: bigint
    ajnaWeightBps: bigint
    solanaWeightBps: bigint
  },
): WeightGateResult {
  if (plan.reasons.charm === 'unpaid' && requested.charmWeightBps !== 0n) {
    return {
      ok: false,
      reason: 'charm_unpaid_but_requested',
      expected: {
        charmWeightBps: plan.charmWeightBps,
        ajnaWeightBps: plan.ajnaWeightBps,
        solanaWeightBps: plan.solanaWeightBps,
        idleReserveBps: plan.idleReserveBps,
      },
      requested,
    }
  }
  if (plan.reasons.ajna === 'unpaid' && requested.ajnaWeightBps !== 0n) {
    return {
      ok: false,
      reason: 'ajna_unpaid_but_requested',
      expected: {
        charmWeightBps: plan.charmWeightBps,
        ajnaWeightBps: plan.ajnaWeightBps,
        solanaWeightBps: plan.solanaWeightBps,
        idleReserveBps: plan.idleReserveBps,
      },
      requested,
    }
  }
  if (requested.solanaWeightBps !== 0n) {
    return {
      ok: false,
      reason: 'solana_unpaid_but_requested',
      expected: {
        charmWeightBps: plan.charmWeightBps,
        ajnaWeightBps: plan.ajnaWeightBps,
        solanaWeightBps: plan.solanaWeightBps,
        idleReserveBps: plan.idleReserveBps,
      },
      requested,
    }
  }
  if (requested.charmWeightBps !== plan.charmWeightBps) {
    return {
      ok: false,
      reason: 'charm_weight_mismatch',
      expected: {
        charmWeightBps: plan.charmWeightBps,
        ajnaWeightBps: plan.ajnaWeightBps,
        solanaWeightBps: plan.solanaWeightBps,
        idleReserveBps: plan.idleReserveBps,
      },
      requested,
    }
  }
  if (requested.ajnaWeightBps !== plan.ajnaWeightBps) {
    return {
      ok: false,
      reason: 'ajna_weight_mismatch',
      expected: {
        charmWeightBps: plan.charmWeightBps,
        ajnaWeightBps: plan.ajnaWeightBps,
        solanaWeightBps: plan.solanaWeightBps,
        idleReserveBps: plan.idleReserveBps,
      },
      requested,
    }
  }
  return { ok: true }
}
