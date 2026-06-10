/**
 * Post-payment provisioning dispatcher for creator strategy features.
 *
 * Called from the /api/creator/strategy/stripe/webhook handler after a
 * `checkout.session.completed` event has moved the row out of the
 * "payment_verified_at NULL" state. Same entrypoint will eventually be
 * called from the x402 + USDC-on-Base paths so provisioning is a
 * single place regardless of payment rail.
 *
 * For v1 this is DELIBERATELY a dispatcher stub: it maps the feature
 * key to a `provisionerTag` and logs the intent, but does NOT actually
 * execute the onchain/off-chain work. Moving `pending -> active`
 * still requires an operator-run script (see
 * `frontend/scripts/activate-strategy-post-deploy.ts`).
 *
 * Why stub first:
 *   - Provisioning each feature is non-trivial (CREATE2 strategy
 *     deploy, Safe tx for addStrategy, Meteora SDK calls, etc.).
 *   - Auto-provisioning without human review is risky for a $100+
 *     operation. The stub records intent so operators can pick up
 *     `pending` rows with a full audit trail.
 *   - When we're ready to automate, each case in `dispatchProvisioning`
 *     becomes a call to a feature-specific provisioner module.
 *
 * Next-step design (not implemented):
 *   - `dispatchProvisioning` returns { ok: 'enqueued' | 'executed', ref }
 *     where `ref` is a job id / tx hash.
 *   - Operator dashboard queries `pending` rows that are past their
 *     `estimatedActivationWindow` and flags them for manual intervention.
 *   - On failure, row moves to `status = 'failed'` with `failure_reason`.
 */

import type { Address } from 'viem'

import {
  CREATOR_STRATEGY_FEATURE_CATALOG,
  getCreatorStrategyFeature,
  type CreatorStrategyFeatureKey,
} from './catalog.js'
import { enqueueSolanaShareMeshProvisioning } from './solanaShareMeshProvisioning.js'

export type ProvisioningRequest = {
  creatorToken: Address
  featureKey: string
  activationId: number
  /** 'stripe' | 'x402_base' | 'usdc_base' */
  paymentSource: string
  /** Free-form id to correlate with payment receipt in support triage. */
  paymentRef: string | null
}

export type ProvisioningResult =
  | {
      ok: true
      outcome: 'enqueued' | 'executed'
      /** Job id / tx hash / Solana sig, etc. Stored in `provisioner_ref`. */
      ref: string | null
      /** Free-form human-readable next step for the operator. */
      note: string
    }
  | {
      ok: false
      reason: 'unknown_feature' | 'not_yet_automated' | 'automation_failed'
      message: string
    }

/**
 * Entrypoint — called from payment-confirming handlers after the
 * activation row is inserted / finalized.
 *
 * Today: logs intent + returns `{ ok: true, outcome: 'enqueued', ref: null }`
 * so callers can safely proceed. Each feature gets routed below; any new
 * feature not in the switch falls through to `not_yet_automated` which
 * is explicitly treated as non-fatal by the webhook (operator picks up
 * the row manually).
 */
export async function dispatchProvisioning(
  request: ProvisioningRequest,
): Promise<ProvisioningResult> {
  const feature = getCreatorStrategyFeature(request.featureKey)
  if (!feature) {
    return {
      ok: false,
      reason: 'unknown_feature',
      message: `Feature key "${request.featureKey}" is not in the catalog`,
    }
  }

  logProvisioningIntent(request, feature.provisionerTag)

  // Feature-specific dispatch. Each arm is stubbed to return
  // `enqueued` without doing the real work. When we automate:
  //
  //   - phase3_strategy_charm    → call activate-strategy-post-deploy
  //   - phase3_strategy_ajna     → same
  //   - solana_meteora           → enqueue Meteora DLMM on share mesh mint
  //
  // Until then, the operator polls `creator_strategy_features` for
  // `status = 'pending'` rows and provisions manually.

  switch (feature.provisionerTag) {
    case 'vault_full_deploy_bundle': {
      const queue = await enqueueSolanaShareMeshProvisioning({
        creatorToken: request.creatorToken,
        activationId: request.activationId,
        paymentSource: request.paymentSource,
        trigger: 'payment',
      })
      return {
        ok: true,
        outcome: 'enqueued',
        ref: queue.jobId ? String(queue.jobId) : null,
        note:
          queue.enqueued
            ? `Full deploy bundle for ${request.creatorToken} queued Solana share-mesh provisioning ` +
              `(keeper job ${queue.jobId ?? 'pending'}). Vault deploy unlocks immediately; Path 1/2 ` +
              'follow-up runs via keeper worker + docs/operations/solana-share-mesh-budget-paths.md.'
            : `Full deploy bundle active for ${request.creatorToken}; Solana queue skipped (${queue.reason ?? 'unknown'}). ` +
              'Follow docs/operations/solana-share-mesh-budget-paths.md for Path 1/2 operator steps.',
      }
    }

    case 'phase3_strategy_charm':
    case 'phase3_strategy_ajna':
      return {
        ok: true,
        outcome: 'enqueued',
        ref: null,
        note:
          `Deploy-gating feature "${feature.key}" requires vault-owner-authorized calls ` +
          `(addStrategy + setStrategyWeight). Run ` +
          `\`pnpm -C frontend exec tsx scripts/activate-strategy-post-deploy.ts ` +
          `--creator ${request.creatorToken} --feature ${feature.key}\` to generate ` +
          `the Safe calldata, then submit via app.safe.global.`,
      }

    case 'solana_meteora':
      return {
        ok: true,
        outcome: 'enqueued',
        ref: null,
        note:
          `Meteora add-on for ${request.creatorToken} needs share-mesh Path 1 live, then ` +
          `(a) Meteora DLMM pool on the LZ share mint via ` +
          `\`pnpm -C kpr solana:create-dlmm-pool\`, (b) optional Alpha Vault, ` +
          `(c) row in \`creator_meteora_alpha_vaults\` when used. See ` +
          `docs/operations/solana-share-mesh-budget-paths.md and ` +
          `docs/operations/creator-strategy-features.md § "solana_meteora_alpha_vault".`,
      }

    default:
      return {
        ok: false,
        reason: 'not_yet_automated',
        message:
          `No provisioner wired for tag "${feature.provisionerTag}". Operator must ` +
          `manually pick up the \`pending\` row and follow the catalog runbook.`,
      }
  }
}

/**
 * Structured log emission for provisioning intent. Centralizes the log
 * shape so ops tooling can parse it consistently across payment paths.
 */
function logProvisioningIntent(request: ProvisioningRequest, provisionerTag: string): void {
  console.log('[creator-strategy-provisioner]', {
    at: 'dispatchProvisioning',
    activationId: request.activationId,
    creatorToken: request.creatorToken,
    featureKey: request.featureKey,
    provisionerTag,
    paymentSource: request.paymentSource,
    paymentRef: request.paymentRef,
    mode: 'enqueue_only_v1',
  })
}

/**
 * Helper exposed for tests + the operator dashboard — returns the list
 * of features whose provisioning is still entirely manual (so operators
 * know what to watch for).
 */
export function listManualProvisioningFeatures(): Array<{
  key: CreatorStrategyFeatureKey
  provisionerTag: string
}> {
  return Object.values(CREATOR_STRATEGY_FEATURE_CATALOG).map((f) => ({
    key: f.key,
    provisionerTag: f.provisionerTag,
  }))
}
