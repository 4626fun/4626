/**
 * Auction Settlement Keeper Action — onchain read/write logic.
 *
 * Monitors CCALaunchStrategy for graduated auctions and:
 *   1. Calls sweepCurrency() when isGraduated() == true (settles auction + configures V4 pool)
 *   2. Calls sweepUnsoldTokens() after settlement
 *
 * Note: sweepCurrency() and sweepUnsoldTokens() have no access modifier —
 * anyone can call them. No keeper role authorization needed.
 *
 * Supports both single-vault mode (via CCA_STRATEGY_ADDRESS env) and multi-vault mode
 * (via registry API).
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
import { fetchActiveVaults, filterVaultsForWorkflow, type VaultConfig } from '../utils/registry.js';

const WORKFLOW_NAME = 'auction-settlement';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuctionState {
  ccaStrategyAddress: `0x${string}`;
  currentAuction: `0x${string}`;
  hasActiveAuction: boolean;
  isGraduated: boolean;
}

export interface SettlementResult {
  ccaStrategyAddress: `0x${string}`;
  swept: boolean;
  unsoldSwept: boolean;
  sweepResult?: WriteResult;
  unsoldSweepResult?: WriteResult;
  skippedReason?: string;
}

export interface BatchSettlementResult {
  totalStrategies: number;
  processed: number;
  settled: number;
  skipped: number;
  errors: number;
  results: SettlementResult[];
}

// ---------------------------------------------------------------------------
// Read phase
// ---------------------------------------------------------------------------

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Read auction state for a specific CCA strategy address.
 */
export async function readAuctionStateForAddress(ccaStrategyAddress: `0x${string}`): Promise<AuctionState> {
  const currentAuction = await readContract<`0x${string}`>({
    address: ccaStrategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'currentAuction',
  });

  const hasActiveAuction = currentAuction !== ZERO_ADDRESS;

  let isGraduated = false;
  if (hasActiveAuction) {
    try {
      isGraduated = await readContract<boolean>({
        address: currentAuction,
        abi: CCA_AUCTION_ABI,
        functionName: 'isGraduated',
      });
    } catch {
      // If isGraduated() reverts, auction may be in an unusual state
      isGraduated = false;
    }
  }

  return { ccaStrategyAddress, currentAuction, hasActiveAuction, isGraduated };
}

// ---------------------------------------------------------------------------
// Single strategy execution
// ---------------------------------------------------------------------------

/**
 * Execute settlement logic for a single CCA strategy.
 */
export async function executeSettlementForStrategy(ccaStrategyAddress: `0x${string}`): Promise<SettlementResult> {
  const state = await readAuctionStateForAddress(ccaStrategyAddress);
  const shortAddr = `${ccaStrategyAddress.slice(0, 6)}...${ccaStrategyAddress.slice(-4)}`;
  const result: SettlementResult = { ccaStrategyAddress, swept: false, unsoldSwept: false };

  // Guard: no active auction
  if (!state.hasActiveAuction) {
    console.log(`[${shortAddr}] No active auction — skipping`);
    result.skippedReason = 'no_active_auction';
    return result;
  }

  // Guard: auction not graduated yet
  if (!state.isGraduated) {
    console.log(`[${shortAddr}] Auction not graduated — waiting`);
    result.skippedReason = 'not_graduated';
    return result;
  }

  // --- Step 1: sweepCurrency() ---
  console.log(`[${shortAddr}] Auction graduated! Calling sweepCurrency()`);

  const sweepResult = await writeContract({
    address: ccaStrategyAddress,
    abi: CCA_STRATEGY_ABI,
    functionName: 'sweepCurrency',
  });

  result.swept = sweepResult.success;
  result.sweepResult = sweepResult;

  if (sweepResult.success) {
    console.log(`[${shortAddr}] sweepCurrency() succeeded — tx: ${sweepResult.txHash}`);
    await alertInfo(WORKFLOW_NAME, `Auction settled for ${shortAddr}`, {
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
    // Don't attempt unsold sweep if currency sweep failed
    return result;
  }

  // --- Step 2: sweepUnsoldTokens() ---
  console.log(`[${shortAddr}] Sweeping unsold tokens`);

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

  return result;
}

// ---------------------------------------------------------------------------
// Multi-strategy execution
// ---------------------------------------------------------------------------

/**
 * Execute settlement logic for all CCA strategies from the registry.
 * Falls back to single-strategy mode if CCA_STRATEGY_ADDRESS is set.
 */
export async function executeSettlement(): Promise<BatchSettlementResult> {
  // Check for single-strategy mode (backwards compatibility)
  const singleStrategy = process.env.CCA_STRATEGY_ADDRESS;
  if (singleStrategy && singleStrategy.startsWith('0x') && singleStrategy.length === 42) {
    console.log('Running in single-strategy mode (CCA_STRATEGY_ADDRESS is set)');
    const result = await executeSettlementForStrategy(singleStrategy as `0x${string}`);
    return {
      totalStrategies: 1,
      processed: 1,
      settled: result.swept ? 1 : 0,
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
    vaults = filterVaultsForWorkflow(allVaults, 'auction-settlement');
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

  const batchResult: BatchSettlementResult = {
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
      const result = await executeSettlementForStrategy(vault.ccaStrategyAddress);
      batchResult.results.push(result);
      batchResult.processed++;

      if (result.swept) batchResult.settled++;
      if (result.skippedReason) batchResult.skipped++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${vault.ccaStrategyAddress}] Error: ${message}`);
      batchResult.errors++;
      batchResult.results.push({
        ccaStrategyAddress: vault.ccaStrategyAddress,
        swept: false,
        unsoldSwept: false,
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
