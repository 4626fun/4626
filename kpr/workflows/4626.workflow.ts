/**
 * KPR Workflow: 4626 Unified Keeper
 *
 * Schedule: Every 5 minutes
 *
 * Single workflow that handles all vault automation:
 *   1. Vault Keeper   — tend() idle funds, report() yields (per vault)
 *   2. Payout Router   — claim protocol rewards + convertAndQueue routed balances
 *   3. Ajna Buckets    — liquidity-aware bucket moves from oracle TWAP
 *   4. Charm Rebalance — trigger Charm vault rebalance on 10%+ move
 *   5. Auction Settle  — sweepCurrency() graduated auctions (per CCA strategy)
 *   6. Keepr Queue     — execute pending XMTP/Neynar group actions
 *   7. Bridge Integrity — monitor bridge signer/route/scalar/liveness drift
 *
 * All vaults are fetched from the registry API (keepr_vaults table).
 * Falls back to single-vault env vars if KPR_API_KEY is not set.
 */

import { executeKeeper, type BatchKeeperResult } from '../actions/vault-keeper.action.js';
import {
  executePayoutRouterHarvest,
  type BatchPayoutRouterHarvestResult,
} from '../actions/payout-router-harvest.action.js';
import {
  executeAjnaBucketManager,
  type BatchAjnaBucketResult,
} from '../actions/ajna-bucket-manager.action.js';
import {
  executeCharmRebalanceManager,
  type BatchCharmRebalanceResult,
} from '../actions/charm-rebalance-manager.action.js';
import { executeCcaFinalization, type BatchCcaFinalizationResult } from '../actions/cca-finalization.action.js';
import { executeKeeprActionQueue, type KeeprActionQueueResult } from '../actions/keepr-action-queue.action.js';
import {
  executeBridgeIntegrityMonitor,
  type BridgeIntegrityMonitorResult,
} from '../actions/bridge-integrity-monitor.action.js';
import {
  executeVaultStrategyReallocator,
  type BatchVaultStrategyReallocateResult,
} from '../actions/vault-strategy-reallocator.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = '4626';

function shouldRunDirectCharmRebalance(): boolean {
  const mode = String(process.env.CHARM_REBALANCE_CANONICAL_MODE ?? 'queue').trim().toLowerCase();
  return mode === 'direct';
}

export interface UnifiedResult {
  keeper: BatchKeeperResult | null;
  payoutRouter: BatchPayoutRouterHarvestResult | null;
  ajnaBuckets: BatchAjnaBucketResult | null;
  charmRebalance: BatchCharmRebalanceResult | null;
  settlement: BatchCcaFinalizationResult | null;
  queue: KeeprActionQueueResult | null;
  bridgeIntegrity: BridgeIntegrityMonitorResult | null;
  strategyReallocator: BatchVaultStrategyReallocateResult | null;
  errors: string[];
  durationMs: number;
}

/**
 * KPR entrypoint — called on each cron trigger.
 */
export async function handler(): Promise<void> {
  const start = Date.now();
  const errors: string[] = [];
  let keeperResult: BatchKeeperResult | null = null;
  let payoutRouterResult: BatchPayoutRouterHarvestResult | null = null;
  let ajnaBucketsResult: BatchAjnaBucketResult | null = null;
  let charmRebalanceResult: BatchCharmRebalanceResult | null = null;
  let settlementResult: BatchCcaFinalizationResult | null = null;
  let queueResult: KeeprActionQueueResult | null = null;
  let bridgeIntegrityResult: BridgeIntegrityMonitorResult | null = null;
  let strategyReallocatorResult: BatchVaultStrategyReallocateResult | null = null;

  // ── 1. Vault Keeper (tend + report) ──────────────────────────────────
  try {
    console.log('═══ Vault Keeper ═══');
    keeperResult = await executeKeeper();
    console.log(
      `  vaults=${keeperResult.totalVaults} tended=${keeperResult.tended} reported=${keeperResult.reported} ` +
        `skipped=${keeperResult.skipped} errors=${keeperResult.errors}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  vault-keeper failed: ${msg}`);
    errors.push(`vault-keeper: ${msg}`);
  }

  // ── 2. Payout Router Processor (claim + convertAndQueue) ─────────────
  try {
    console.log('═══ Payout Router Harvest ═══');
    payoutRouterResult = await executePayoutRouterHarvest();
    console.log(
      `  vaults=${payoutRouterResult.totalVaults} processed=${payoutRouterResult.processed} ` +
        `claimed=${payoutRouterResult.claimedVaults} converted=${payoutRouterResult.converted} ` +
        `skipped=${payoutRouterResult.skipped} errors=${payoutRouterResult.errors}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  payout-router-harvest failed: ${msg}`);
    errors.push(`payout-router-harvest: ${msg}`);
  }

  // ── 3. Ajna Bucket Manager (TWAP + liquidity-aware) ──────────────────
  try {
    console.log('═══ Ajna Bucket Manager ═══');
    ajnaBucketsResult = await executeAjnaBucketManager();
    console.log(
      `  vaults=${ajnaBucketsResult.totalVaults} strategies=${ajnaBucketsResult.totalStrategies} moved=${ajnaBucketsResult.moved} ` +
        `skipped=${ajnaBucketsResult.skipped} errors=${ajnaBucketsResult.errors}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ajna-bucket-manager failed: ${msg}`);
    errors.push(`ajna-bucket-manager: ${msg}`);
  }

  // ── 4. Charm Rebalance Manager (oracle price-move trigger) ───────────
  // Canonical default is event producer + queue executor to avoid dual-writer races.
  if (shouldRunDirectCharmRebalance()) {
    try {
      console.log('═══ Charm Rebalance Manager ═══');
      charmRebalanceResult = await executeCharmRebalanceManager();
      console.log(
        `  vaults=${charmRebalanceResult.totalVaults} strategies=${charmRebalanceResult.totalStrategies} ` +
          `rebalanced=${charmRebalanceResult.rebalanced} skipped=${charmRebalanceResult.skipped} ` +
          `errors=${charmRebalanceResult.errors}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  charm-rebalance-manager failed: ${msg}`);
      errors.push(`charm-rebalance-manager: ${msg}`);
    }
  } else {
    console.log('═══ Charm Rebalance Manager ═══');
    console.log('  skipped: canonical queue mode enabled (set CHARM_REBALANCE_CANONICAL_MODE=direct to override)');
  }

  // ── 5. Auction Settlement (sweepCurrency + sweepUnsoldTokens) ────────
  try {
    console.log('═══ CCA Finalization ═══');
    settlementResult = await executeCcaFinalization();
    console.log(
      `  strategies=${settlementResult.totalStrategies} settled=${settlementResult.settled} ` +
        `skipped=${settlementResult.skipped} errors=${settlementResult.errors}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  cca-finalization failed: ${msg}`);
    errors.push(`cca-finalization: ${msg}`);
  }

  // ── 6. Keepr Queue (XMTP group ops + Neynar/Farcaster) ──────────────
  try {
    console.log('═══ Keepr Action Queue ═══');
    queueResult = await executeKeeprActionQueue();
    console.log(
      `  processed=${queueResult.processed} succeeded=${queueResult.succeeded} ` +
        `failed=${queueResult.failed} retried=${queueResult.retried}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Queue errors are non-fatal if the API isn't configured yet
    if (msg.includes('Missing required env var')) {
      console.log(`  keepr-action-queue skipped: ${msg}`);
    } else {
      console.error(`  keepr-action-queue failed: ${msg}`);
      errors.push(`keepr-action-queue: ${msg}`);
    }
  }

  // ── 7. Bridge Integrity Monitor (signer/route/scalar/liveness) ─────────
  try {
    console.log('═══ Bridge Integrity Monitor ═══');
    bridgeIntegrityResult = await executeBridgeIntegrityMonitor();
    console.log(
      `  status=${bridgeIntegrityResult.status} checks=${bridgeIntegrityResult.checksRun} ` +
        `routes=${bridgeIntegrityResult.monitoredRoutes} overlaps=${bridgeIntegrityResult.signerOverlapCount} ` +
        `critical=${bridgeIntegrityResult.criticalFindings.length} warnings=${bridgeIntegrityResult.warningFindings.length}`,
    );
    // Critical monitor findings are surfaced via workflow-level error summary.
    if (bridgeIntegrityResult.status === 'critical') {
      errors.push(
        `bridge-integrity-monitor: ${bridgeIntegrityResult.criticalFindings.join(' | ') || 'critical findings detected'}`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  bridge-integrity-monitor failed: ${msg}`);
    errors.push(`bridge-integrity-monitor: ${msg}`);
  }

  // ── 8. Cross-strategy TVL reallocator (Charm ↔ Ajna via vault idle) ───
  try {
    console.log('═══ Vault Strategy Reallocator ═══');
    strategyReallocatorResult = await executeVaultStrategyReallocator();
    console.log(
      `  vaults=${strategyReallocatorResult.totalVaults} rebalanced=${strategyReallocatorResult.rebalanced} ` +
        `skipped=${strategyReallocatorResult.skipped} errors=${strategyReallocatorResult.errors}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  vault-strategy-reallocator failed: ${msg}`);
    errors.push(`vault-strategy-reallocator: ${msg}`);
  }

  const durationMs = Date.now() - start;

  // ── Summary ──────────────────────────────────────────────────────────
  const summary = {
    workflow: WORKFLOW_NAME,
    timestamp: new Date().toISOString(),
    durationMs,
    keeper: keeperResult
      ? { vaults: keeperResult.totalVaults, tended: keeperResult.tended, reported: keeperResult.reported }
      : null,
    payoutRouter: payoutRouterResult
      ? {
          vaults: payoutRouterResult.totalVaults,
          processed: payoutRouterResult.processed,
          claimedVaults: payoutRouterResult.claimedVaults,
          converted: payoutRouterResult.converted,
        }
      : null,
    ajnaBuckets: ajnaBucketsResult
      ? {
          vaults: ajnaBucketsResult.totalVaults,
          strategies: ajnaBucketsResult.totalStrategies,
          moved: ajnaBucketsResult.moved,
        }
      : null,
    charmRebalance: charmRebalanceResult
      ? {
          vaults: charmRebalanceResult.totalVaults,
          strategies: charmRebalanceResult.totalStrategies,
          rebalanced: charmRebalanceResult.rebalanced,
        }
      : null,
    settlement: settlementResult
      ? { strategies: settlementResult.totalStrategies, settled: settlementResult.settled }
      : null,
    queue: queueResult
      ? { processed: queueResult.processed, succeeded: queueResult.succeeded }
      : null,
    bridgeIntegrity: bridgeIntegrityResult
      ? {
          status: bridgeIntegrityResult.status,
          checksRun: bridgeIntegrityResult.checksRun,
          monitoredRoutes: bridgeIntegrityResult.monitoredRoutes,
          criticalFindings: bridgeIntegrityResult.criticalFindings.length,
          warningFindings: bridgeIntegrityResult.warningFindings.length,
        }
      : null,
    strategyReallocator: strategyReallocatorResult
      ? {
          vaults: strategyReallocatorResult.totalVaults,
          rebalanced: strategyReallocatorResult.rebalanced,
          skipped: strategyReallocatorResult.skipped,
        }
      : null,
    errors: errors.length,
  };

  console.log(JSON.stringify(summary));

  if (errors.length > 0) {
    await alertCritical(WORKFLOW_NAME, `Workflow completed with ${errors.length} error(s)`, {
      errors,
      durationMs,
    });
  }
}

// ---------------------------------------------------------------------------
// KPR workflow configuration export
// ---------------------------------------------------------------------------

export const workflow = {
  name: WORKFLOW_NAME,
  schedule: '*/5 * * * *', // Every 5 minutes
  handler,
};

export default workflow;
