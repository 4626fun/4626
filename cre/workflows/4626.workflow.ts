/**
 * CRE Workflow: 4626 Unified Keeper
 *
 * Schedule: Every 5 minutes
 *
 * Single workflow that handles all vault automation:
 *   1. Vault Keeper   — tend() idle funds, report() yields (per vault)
 *   2. Ajna Buckets    — liquidity-aware bucket moves from oracle TWAP
 *   3. Charm Rebalance — trigger Charm vault rebalance on 10%+ move
 *   4. Auction Settle  — sweepCurrency() graduated auctions (per CCA strategy)
 *   5. Keepr Queue     — execute pending XMTP/Neynar group actions
 *   6. Bridge Integrity — monitor bridge signer/route/scalar/liveness drift
 *
 * All vaults are fetched from the registry API (keepr_vaults table).
 * Falls back to single-vault env vars if KEEPR_API_KEY is not set.
 */

import { executeKeeper, type BatchKeeperResult } from '../actions/vault-keeper.action.js';
import {
  executeAjnaBucketManager,
  type BatchAjnaBucketResult,
} from '../actions/ajna-bucket-manager.action.js';
import {
  executeCharmRebalanceManager,
  type BatchCharmRebalanceResult,
} from '../actions/charm-rebalance-manager.action.js';
import { executeSettlement, type BatchSettlementResult } from '../actions/auction-settlement.action.js';
import { executeQueueProcessor, type QueueExecutorResult } from '../actions/keepr-queue-executor.action.js';
import {
  executeBridgeIntegrityMonitor,
  type BridgeIntegrityMonitorResult,
} from '../actions/bridge-integrity-monitor.action.js';
import { alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = '4626';

export interface UnifiedResult {
  keeper: BatchKeeperResult | null;
  ajnaBuckets: BatchAjnaBucketResult | null;
  charmRebalance: BatchCharmRebalanceResult | null;
  settlement: BatchSettlementResult | null;
  queue: QueueExecutorResult | null;
  bridgeIntegrity: BridgeIntegrityMonitorResult | null;
  errors: string[];
  durationMs: number;
}

/**
 * CRE entrypoint — called on each cron trigger.
 */
export async function handler(): Promise<void> {
  const start = Date.now();
  const errors: string[] = [];
  let keeperResult: BatchKeeperResult | null = null;
  let ajnaBucketsResult: BatchAjnaBucketResult | null = null;
  let charmRebalanceResult: BatchCharmRebalanceResult | null = null;
  let settlementResult: BatchSettlementResult | null = null;
  let queueResult: QueueExecutorResult | null = null;
  let bridgeIntegrityResult: BridgeIntegrityMonitorResult | null = null;

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

  // ── 2. Ajna Bucket Manager (TWAP + liquidity-aware) ──────────────────
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

  // ── 3. Charm Rebalance Manager (oracle price-move trigger) ───────────
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

  // ── 4. Auction Settlement (sweepCurrency + sweepUnsoldTokens) ────────
  try {
    console.log('═══ Auction Settlement ═══');
    settlementResult = await executeSettlement();
    console.log(
      `  strategies=${settlementResult.totalStrategies} settled=${settlementResult.settled} ` +
        `skipped=${settlementResult.skipped} errors=${settlementResult.errors}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  auction-settlement failed: ${msg}`);
    errors.push(`auction-settlement: ${msg}`);
  }

  // ── 5. Keepr Queue (XMTP group ops + Neynar/Farcaster) ──────────────
  try {
    console.log('═══ Keepr Queue ═══');
    queueResult = await executeQueueProcessor();
    console.log(
      `  processed=${queueResult.processed} succeeded=${queueResult.succeeded} ` +
        `failed=${queueResult.failed} retried=${queueResult.retried}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Queue errors are non-fatal if the API isn't configured yet
    if (msg.includes('Missing required env var')) {
      console.log(`  keepr-queue skipped: ${msg}`);
    } else {
      console.error(`  keepr-queue failed: ${msg}`);
      errors.push(`keepr-queue: ${msg}`);
    }
  }

  // ── 6. Bridge Integrity Monitor (signer/route/scalar/liveness) ─────────
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

  const durationMs = Date.now() - start;

  // ── Summary ──────────────────────────────────────────────────────────
  const summary = {
    workflow: WORKFLOW_NAME,
    timestamp: new Date().toISOString(),
    durationMs,
    keeper: keeperResult
      ? { vaults: keeperResult.totalVaults, tended: keeperResult.tended, reported: keeperResult.reported }
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
// CRE workflow configuration export
// ---------------------------------------------------------------------------

export const workflow = {
  name: WORKFLOW_NAME,
  schedule: '*/5 * * * *', // Every 5 minutes
  handler,
};

export default workflow;
