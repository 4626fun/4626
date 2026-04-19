/**
 * Resolve which Phase 3 strategy slots a creator has paid for.
 *
 * Reads active `creator_strategy_features` rows for the given creator
 * token and returns the Phase-3 weight triple the deploy session should
 * pass to `DeploymentBatcher.deployPhase3Strategies`. Strategies the
 * creator has not activated are returned with `weightBps = 0`, which the
 * patched `DeploymentBatcher` interprets as "skip this strategy
 * entirely" (no deploy, no addStrategy call, result address stays zero).
 *
 * Every productive strategy is opt-in and paid: Charm, Ajna, and Solana
 * are all gated behind $100 USDC activations. **At least one paid
 * strategy is required** — the contract rejects a weight sum of zero,
 * and this resolver returns `ok: false` when nothing is active so the
 * deploy page can block submission until the creator activates at least
 * one feature.
 *
 * Weight scaling: paid strategies split a fixed productive budget
 * (`TOTAL_ALLOCATION_BPS - DEFAULT_IDLE_RESERVE_BPS` = `9_000` bps)
 * evenly, with the idle reserve fixed at `1_000` bps regardless of
 * strategy count. So:
 *   1 strategy : 9_000 bps → that strategy gets 90 %  (idle 10 %)
 *   2 strategies : 4_500 bps each → 45 % / 45 %        (idle 10 %)
 *   3 strategies : 3_000 bps each → 30 % / 30 % / 30 % (idle 10 %)
 *
 * Note: the server-side deploy session is the AUTHORITATIVE enforcement
 * point for weight gating. A client that constructs a UserOp with
 * `charmWeightBps > 0` but no `charm_active_lp` activation must be
 * refused by the paymaster / deploy-continue handler using this
 * resolver's output as the truth. Enforcement wiring lives in
 * `deploy/session/_continue.ts` (follow-up).
 */

import type { Address } from 'viem'
import { getAddress } from 'viem'

import {
  DEPLOY_GATING_FEATURE_KEYS,
  type CreatorStrategyFeatureKey,
} from './catalog.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

/**
 * Fixed idle reserve in bps. Kept constant across strategy counts so
 * creators always have a predictable withdrawal buffer. If we later let
 * creators customize this, it becomes a per-creator column rather than
 * a constant — but the resolver's API shape doesn't change.
 */
export const DEFAULT_IDLE_RESERVE_BPS = 1_000n
export const TOTAL_ALLOCATION_BPS = 10_000n
export const PRODUCTIVE_ALLOCATION_BPS = TOTAL_ALLOCATION_BPS - DEFAULT_IDLE_RESERVE_BPS // 9_000

/**
 * Per-strategy weights for the canonical 3-strategy split. Exported as
 * named constants for test-time reference, but the runtime resolver
 * computes them dynamically by dividing `PRODUCTIVE_ALLOCATION_BPS` by
 * the number of active strategies (so 1 active ⇒ 9_000, not 3_000).
 */
export const DEFAULT_CHARM_WEIGHT_BPS = PRODUCTIVE_ALLOCATION_BPS / 3n // 3_000
export const DEFAULT_AJNA_WEIGHT_BPS = PRODUCTIVE_ALLOCATION_BPS / 3n // 3_000
export const DEFAULT_SOLANA_WEIGHT_BPS = PRODUCTIVE_ALLOCATION_BPS / 3n // 3_000

export type StrategyWeights = {
  charmWeightBps: bigint
  ajnaWeightBps: bigint
  solanaWeightBps: bigint
  idleReserveBps: bigint
}

export type ResolvedStrategyPlan = StrategyWeights & {
  creatorToken: Address
  /**
   * Human-friendly reason string for each strategy (why it's included / skipped).
   * Useful for surfacing in the UI and for support triage.
   */
  reasons: {
    charm: 'paid' | 'unpaid'
    ajna: 'paid' | 'unpaid'
    solana: 'paid' | 'unpaid'
  }
  activeFeatureKeys: CreatorStrategyFeatureKey[]
}

/**
 * Read which gated features the creator currently has active or pending
 * payment for. Both `pending` (payment verified, awaiting operator
 * provisioning) and `active` count as "paid" — because payment is
 * authoritative and provisioning is an internal-ops concern. Returning
 * pending as paid lets the creator deploy their vault the instant their
 * USDC transfer clears rather than blocking on an operator step.
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
  const keys = new Set<CreatorStrategyFeatureKey>()
  for (const row of result.rows ?? []) {
    const raw = String(row.feature_key ?? '')
    if (
      raw === 'charm_active_lp' ||
      raw === 'ajna_sleeve' ||
      raw === 'solana_bridge_strategy' ||
      raw === 'solana_meteora_alpha_vault'
    ) {
      keys.add(raw)
    }
  }
  return keys
}

/**
 * Turn a set of active feature keys into the Phase 3 weight triple.
 * Pure function — no I/O — so it's trivially testable.
 */
/**
 * Turn a set of active feature keys into the Phase 3 weight triple.
 *
 * Returns `{ ok: false }` when zero strategies are paid — the contract
 * rejects a zero-weight deploy so we bail out early rather than
 * producing a plan that will revert.
 *
 * Weight scaling splits `PRODUCTIVE_ALLOCATION_BPS` (9_000) evenly
 * across the active strategies. 9_000 is divisible cleanly by 1, 2, and
 * 3 (9_000 / 9_000 / 4_500 / 3_000 respectively), so there are no
 * rounding remainders to allocate; total always sums to exactly
 * `TOTAL_ALLOCATION_BPS`. Pure function — no I/O — easily testable.
 */
export type ComputeStrategyWeightsResult =
  | { ok: true; weights: StrategyWeights }
  | { ok: false; reason: 'no_paid_strategies' }

export function computeStrategyWeights(
  activeKeys: ReadonlySet<CreatorStrategyFeatureKey>,
): ComputeStrategyWeightsResult {
  const charmPaid = activeKeys.has(DEPLOY_GATING_FEATURE_KEYS.charm)
  const ajnaPaid = activeKeys.has(DEPLOY_GATING_FEATURE_KEYS.ajna)
  const solanaPaid = activeKeys.has(DEPLOY_GATING_FEATURE_KEYS.solana)
  const activeCount = BigInt(
    (charmPaid ? 1 : 0) + (ajnaPaid ? 1 : 0) + (solanaPaid ? 1 : 0),
  )
  if (activeCount === 0n) return { ok: false, reason: 'no_paid_strategies' }

  const perStrategyBps = PRODUCTIVE_ALLOCATION_BPS / activeCount
  const charmWeightBps = charmPaid ? perStrategyBps : 0n
  const ajnaWeightBps = ajnaPaid ? perStrategyBps : 0n
  const solanaWeightBps = solanaPaid ? perStrategyBps : 0n
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

/**
 * Convenience: read DB + compute weights in one call.
 *
 * Returns a tagged result so callers can handle the "no strategies
 * paid" case explicitly rather than getting a zero-weight plan that
 * would revert on-chain.
 */
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
        solana: active.has(DEPLOY_GATING_FEATURE_KEYS.solana) ? 'paid' : 'unpaid',
      },
      activeFeatureKeys: Array.from(active),
    },
  }
}

/**
 * Assert that a client-supplied Phase 3 weight triple matches the
 * server's authoritative plan for this creator. Returns an error shape
 * (not throwing) so the deploy-continue handler can produce a clean API
 * envelope.
 *
 * The check is strict: requested weights must equal the resolver's
 * defaults for paid strategies (so the client can't request 9_900 bps
 * for Charm with a $100 payment). If we later let creators customize
 * weights, extend this to enforce sane minima / maxima per strategy.
 */
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
  if (plan.reasons.solana === 'unpaid' && requested.solanaWeightBps !== 0n) {
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
  if (requested.solanaWeightBps !== plan.solanaWeightBps) {
    return {
      ok: false,
      reason: 'solana_weight_mismatch',
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
