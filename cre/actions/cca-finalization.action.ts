/**
 * CCA Finalization Action — onchain read/write logic (NON-CANONICAL for
 * settlement state).
 *
 * Monitors CCALaunchStrategy for graduated auctions and, per lifecycle flags,
 * attempts these three onchain writes in order:
 *   1. sweepCurrency()       — settles auction currency (initializes V4 pool input)
 *   2. migrate()             — creates the V4 pool + mints the seeded LP position
 *   3. sweepUnsoldTokens()   — best-effort cleanup of unsold auction tokens
 *
 * Failure path: calls finalizeFailedAuction() when the auction ended without
 * graduating.
 *
 * Canonical completion truth lives in `/api/cre/keeper/sweep` (see
 * `frontend/api/_handlers/cre/keeper/_sweep.ts`). That endpoint enforces the
 * full multi-stage state machine:
 *   sweep → migrate → hook fee-plane configuration → invariant gate → completed.
 * It is the only path permitted to write DB `settledAt`.
 *
 * This action MUST NOT be treated as an alternate source of "fully settled"
 * state. It does not:
 *   - configure the hook fee plane,
 *   - enforce deploy/completion invariants (see
 *     `docs/audits/creatorvault-business-logic-core-structure-audit.md`
 *     §5 "Deployment Invariant Checklist"),
 *   - transition a vault to `completed` / `settledAt`.
 *
 * Callers using this file directly are expected to be non-canonical paths
 * (manual tools, local dev) and should not mark DB settlement.
 *
 * Access: sweepCurrency(), migrate(), and sweepUnsoldTokens() have no access
 * modifier — anyone can call them. No keeper role authorization needed.
 *
 * Supports both single-vault mode (via CCA_STRATEGY_ADDRESS env) and
 * multi-vault mode (via registry API).
 */

import {
  CCA_STRATEGY_ABI,
  CCA_AUCTION_ABI,
  CHAINS,
} from '../config.js';
import {
  readContract,
  writeContract,
  type WriteResult,
} from '../utils/onchain.js';
import {
  alertInfo,
  alertWarning,
  alertCritical,
} from '../utils/alerts.js';
import {
  fetchActiveVaults,
  filterVaultsForWorkflow,
  verifyVaultRegistryBinding,
  type VaultConfig,
} from '../utils/registry.js';

const WORKFLOW_NAME = 'cca-finalization';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuctionState {
  ccaStrategyAddress: `0x${string}`;
  currentAuction: `0x${string}`;
  hasActiveAuction: boolean;
  isGraduated: boolean;
  endBlock: bigint;
  migrationBlock: bigint;
  currencySwept: boolean;
  unsoldSwept: boolean;
  migrated: boolean;
  failedFinalized: boolean;
}

export interface CcaFinalizationResult {
  ccaStrategyAddress: `0x${string}`;
  swept: boolean;
  unsoldSwept: boolean;
  migrated: boolean;
  failedFinalized: boolean;
  sweepResult?: WriteResult;
  unsoldSweepResult?: WriteResult;
  migrateResult?: WriteResult;
  failedFinalizeResult?: WriteResult;
  skippedReason?: string;
}

export interface BatchCcaFinalizationResult {
  totalStrategies: number;
  processed: number;
  settled: number;
  skipped: number;
  errors: number;
  results: CcaFinalizationResult[];
}

// ---------------------------------------------------------------------------
// Read phase
// ---------------------------------------------------------------------------

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Read auction state for a specific CCA strategy address.
 */
export async function readAuctionStateForAddress(ccaStrategyAddress: `0x${string}`): Promise<AuctionState> {
  const lifecycle = await readContract<any>({
    address: ccaStrategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getLifecycleStatus',
  }).catch(() => null);

  const currentAuction = (lifecycle?.auction as `0x${string}` | undefined) ?? ZERO_ADDRESS;
  const hasActiveAuction = currentAuction !== ZERO_ADDRESS;
  const isGraduated = Boolean(lifecycle?.isGraduated ?? false);

  return {
    ccaStrategyAddress,
    currentAuction,
    hasActiveAuction,
    isGraduated,
    endBlock: BigInt(lifecycle?.endBlock ?? 0),
    migrationBlock: BigInt(lifecycle?.migrationBlock ?? 0),
    currencySwept: Boolean(lifecycle?.currencySwept ?? false),
    unsoldSwept: Boolean(lifecycle?.unsoldSwept ?? false),
    migrated: Boolean(lifecycle?.migrated ?? false),
    failedFinalized: Boolean(lifecycle?.failedFinalized ?? false),
  };
}

/**
 * Check if the auction has already been swept on-chain (sweepCurrencyBlock > 0).
 * Returns true if already swept, meaning we can skip settlement.
 */
export async function isAlreadySwept(auctionAddress: `0x${string}`): Promise<boolean> {
  try {
    const sweepBlock = await readContract<bigint>({
      address: auctionAddress,
      abi: CCA_AUCTION_ABI,
      functionName: 'sweepCurrencyBlock',
    });
    return sweepBlock > 0n;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Single strategy execution
// ---------------------------------------------------------------------------

/**
 * Execute finalization logic for a single CCA strategy.
 */
export async function executeCcaFinalizationForStrategy(ccaStrategyAddress: `0x${string}`): Promise<CcaFinalizationResult> {
  const state = await readAuctionStateForAddress(ccaStrategyAddress);
  const shortAddr = `${ccaStrategyAddress.slice(0, 6)}...${ccaStrategyAddress.slice(-4)}`;
  const result: CcaFinalizationResult = {
    ccaStrategyAddress,
    swept: false,
    unsoldSwept: false,
    migrated: false,
    failedFinalized: false,
  };

  // Guard: no active auction
  if (!state.hasActiveAuction) {
    console.log(`[${shortAddr}] No active auction — skipping`);
    result.skippedReason = 'no_active_auction';
    return result;
  }

  if (state.migrated || state.failedFinalized) {
    console.log(`[${shortAddr}] Launch already finalized — skipping`);
    result.skippedReason = state.migrated ? 'already_migrated' : 'already_failed_finalized';
    return result;
  }

  // Failure path: end block reached with no graduation.
  if (!state.isGraduated) {
    if (state.endBlock === 0n) {
      console.log(`[${shortAddr}] Auction lifecycle missing endBlock — waiting`);
      result.skippedReason = 'lifecycle_missing_end_block';
      return result;
    }

    // We rely on strategy guardrails for exact end-block checks.
    const failedFinalizeResult = await writeContract({
      address: ccaStrategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'finalizeFailedAuction',
    });
    result.failedFinalizeResult = failedFinalizeResult;
    result.failedFinalized = failedFinalizeResult.success;

    if (failedFinalizeResult.success) {
      console.log(`[${shortAddr}] finalizeFailedAuction() succeeded — tx: ${failedFinalizeResult.txHash}`);
      await alertWarning(WORKFLOW_NAME, `Failed auction finalized for ${shortAddr}`, {
        ccaStrategyAddress,
        auctionAddress: state.currentAuction,
        txHash: failedFinalizeResult.txHash,
      });
      return result;
    }

    // If finalization failed (e.g. still live), wait.
    console.log(`[${shortAddr}] Auction not graduated — waiting (${failedFinalizeResult.error ?? 'no_error'})`);
    result.skippedReason = 'not_graduated';
    return result;
  }

  // --- Step 1: sweepCurrency() ---
  if (!state.currencySwept) {
    console.log(`[${shortAddr}] Auction graduated; calling sweepCurrency()`);
    const sweepResult = await writeContract({
      address: ccaStrategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'sweepCurrency',
    });
    result.swept = sweepResult.success;
    result.sweepResult = sweepResult;

    if (sweepResult.success) {
      console.log(`[${shortAddr}] sweepCurrency() succeeded — tx: ${sweepResult.txHash}`);
      await alertInfo(WORKFLOW_NAME, `Auction currency swept for ${shortAddr}`, {
        ccaStrategyAddress,
        auctionAddress: state.currentAuction,
        txHash: sweepResult.txHash,
      });
    } else {
      console.error(`[${shortAddr}] sweepCurrency() failed — ${sweepResult.error}`);
      await alertCritical(WORKFLOW_NAME, `sweepCurrency() failed for ${shortAddr}`, {
        ccaStrategyAddress,
        error: sweepResult.error,
      });
      return result;
    }
  }

  // --- Step 2: migrate() ---
  if (!state.migrated) {
    const migrateResult = await writeContract({
      address: ccaStrategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'migrate',
    });
    result.migrateResult = migrateResult;
    result.migrated = migrateResult.success;

    if (!migrateResult.success) {
      console.warn(`[${shortAddr}] migrate() not executed yet — ${migrateResult.error}`);
      return result;
    }
    console.log(`[${shortAddr}] migrate() succeeded — tx: ${migrateResult.txHash}`);
  }

  // --- Step 3: sweepUnsoldTokens() (best-effort, non-critical) ---
  if (!state.unsoldSwept) {
    console.log(`[${shortAddr}] Sweeping unsold tokens (best-effort)`);
    const unsoldResult = await writeContract({
      address: ccaStrategyAddress,
      abi: CCA_STRATEGY_ABI,
      functionName: 'sweepUnsoldTokens',
    });

    result.unsoldSwept = unsoldResult.success;
    result.unsoldSweepResult = unsoldResult;

    if (unsoldResult.success) {
      console.log(`[${shortAddr}] sweepUnsoldTokens() succeeded — tx: ${unsoldResult.txHash}`);
    } else {
      console.warn(`[${shortAddr}] sweepUnsoldTokens() failed (non-critical) — ${unsoldResult.error}`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Multi-strategy execution
// ---------------------------------------------------------------------------

/**
 * Execute finalization logic for all CCA strategies from the registry.
 * Falls back to single-strategy mode if CCA_STRATEGY_ADDRESS is set.
 */
export async function executeCcaFinalization(): Promise<BatchCcaFinalizationResult> {
  // Check for single-strategy mode (backwards compatibility)
  const singleStrategy = process.env.CCA_STRATEGY_ADDRESS;
  if (singleStrategy && singleStrategy.startsWith('0x') && singleStrategy.length === 42) {
    console.log('Running in single-strategy mode (CCA_STRATEGY_ADDRESS is set)');
    const result = await executeCcaFinalizationForStrategy(singleStrategy as `0x${string}`);
    return {
      totalStrategies: 1,
      processed: 1,
      settled: result.swept || result.migrated || result.failedFinalized ? 1 : 0,
      skipped: result.skippedReason ? 1 : 0,
      errors: 0,
      results: [result],
    };
  }

  // Multi-strategy mode: fetch from registry
  console.log('Running in multi-strategy mode (fetching from registry)');

  let vaults: VaultConfig[];
  try {
    const allVaults = await fetchActiveVaults(CHAINS.base.id);
    vaults = filterVaultsForWorkflow(allVaults, 'cca-finalization');
    console.log(`Found ${vaults.length} strategies to process`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Failed to fetch vaults from registry', { error: message });
    throw err;
  }

  if (vaults.length === 0) {
    console.log('No CCA strategies found in registry');
    return {
      totalStrategies: 0,
      processed: 0,
      settled: 0,
      skipped: 0,
      errors: 0,
      results: [],
    };
  }

  const batchResult: BatchCcaFinalizationResult = {
    totalStrategies: vaults.length,
    processed: 0,
    settled: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  // Process strategies sequentially
  for (const vault of vaults) {
    if (!vault.ccaStrategyAddress) continue;

    try {
      const registryCheck = await verifyVaultRegistryBinding(vault);
      if (!registryCheck.verified) {
        const reason = registryCheck.reason ?? 'registry_verification_failed';
        console.warn(
          `[${vault.ccaStrategyAddress}] Skipping due to registry verification: ${reason}`
        );
        batchResult.results.push({
          ccaStrategyAddress: vault.ccaStrategyAddress,
          swept: false,
          unsoldSwept: false,
          migrated: false,
          failedFinalized: false,
          skippedReason: `registry_unverified: ${reason}`,
        });
        batchResult.processed++;
        batchResult.skipped++;
        continue;
      }

      const result = await executeCcaFinalizationForStrategy(vault.ccaStrategyAddress);
      batchResult.results.push(result);
      batchResult.processed++;

      if (result.swept || result.migrated || result.failedFinalized) batchResult.settled++;
      if (result.skippedReason) batchResult.skipped++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${vault.ccaStrategyAddress}] Error: ${message}`);
      batchResult.errors++;
      batchResult.results.push({
        ccaStrategyAddress: vault.ccaStrategyAddress,
        swept: false,
        unsoldSwept: false,
        migrated: false,
        failedFinalized: false,
        skippedReason: `error: ${message}`,
      });
    }
  }

  // Summary alert if any auctions were settled
  if (batchResult.settled > 0) {
    await alertInfo(WORKFLOW_NAME, 'Batch complete', {
      totalStrategies: batchResult.totalStrategies,
      settled: batchResult.settled,
      skipped: batchResult.skipped,
      errors: batchResult.errors,
    });
  }

  return batchResult;
}

// ---------------------------------------------------------------------------
// Legacy exports for backwards compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use readAuctionStateForAddress instead */
export async function readAuctionState(): Promise<AuctionState> {
  const ccaStrategyAddress = process.env.CCA_STRATEGY_ADDRESS as `0x${string}`;
  if (!ccaStrategyAddress) {
    throw new Error('CCA_STRATEGY_ADDRESS not set');
  }
  return readAuctionStateForAddress(ccaStrategyAddress);
}
