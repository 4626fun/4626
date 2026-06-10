/**
 * Vault Keeper Action — onchain read/write logic.
 *
 * Reads vault state (coinBalance, deploymentThreshold, minimumTotalIdle,
 * totalStrategyWeight, lastReport) and conditionally calls:
 *   - tend()   — when idle funds exceed the deployment threshold
 *   - report() — when >24 h since last report and strategies are active
 *
 * Supports both single-vault mode (via VAULT_ADDRESS env) and multi-vault mode
 * (via registry API).
 */

import {
  VAULT_ABI,
  REPORT_INTERVAL_SECONDS,
  CHAINS,
} from '../config.js';
import {
  readContract,
  writeContract,
  getBlockTimestamp,
  type WriteResult,
} from '../utils/onchain.js';
import {
  postKeeperReport,
  postKeeperTend,
  shouldUseKeeperHttpBridge,
} from '../utils/keeperHttpBridge.js';
import {
  alertInfo,
  alertWarning,
  alertCritical,
  formatTokens,
} from '../utils/alerts.js';
import {
  fetchActiveVaults,
  filterVaultsForWorkflow,
  verifyVaultRegistryBinding,
  type VaultConfig,
} from '../utils/registry.js';

const WORKFLOW_NAME = 'vault-keeper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VaultState {
  vaultAddress: `0x${string}`;
  coinBalance: bigint;
  deploymentThreshold: bigint;
  minimumTotalIdle: bigint;
  totalStrategyWeight: bigint;
  lastReport: bigint;
  isShutdown: boolean;
  paused: boolean;
  totalAssets: bigint;
  totalAssetsAtLastReport: bigint;
  blockTimestamp: bigint;
}

export interface KeeperResult {
  vaultAddress: `0x${string}`;
  tended: boolean;
  reported: boolean;
  tendResult?: WriteResult;
  reportResult?: WriteResult;
  skippedReason?: string;
}

export interface BatchKeeperResult {
  totalVaults: number;
  processed: number;
  tended: number;
  reported: number;
  skipped: number;
  errors: number;
  results: KeeperResult[];
}

// ---------------------------------------------------------------------------
// Read phase
// ---------------------------------------------------------------------------

/**
 * Read vault state for a specific vault address.
 */
export async function readVaultStateForAddress(vaultAddress: `0x${string}`): Promise<VaultState> {
  const [
    coinBalance,
    deploymentThreshold,
    minimumTotalIdle,
    totalStrategyWeight,
    lastReport,
    isShutdown,
    paused,
    totalAssets,
    totalAssetsAtLastReport,
    blockTimestamp,
  ] = await Promise.all([
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'coinBalance' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'deploymentThreshold' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'minimumTotalIdle' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'totalStrategyWeight' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'lastReport' }),
    readContract<boolean>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'isShutdown' }),
    readContract<boolean>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'paused' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'totalAssets' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'totalAssetsAtLastReport' }),
    getBlockTimestamp(),
  ]);

  return {
    vaultAddress,
    coinBalance,
    deploymentThreshold,
    minimumTotalIdle,
    totalStrategyWeight,
    lastReport,
    isShutdown,
    paused,
    totalAssets,
    totalAssetsAtLastReport,
    blockTimestamp,
  };
}

// ---------------------------------------------------------------------------
// Decision logic
// ---------------------------------------------------------------------------

export function shouldTend(state: VaultState): boolean {
  if (state.isShutdown || state.paused) return false;
  if (state.totalStrategyWeight === 0n) return false;

  const minIdle =
    state.minimumTotalIdle > state.deploymentThreshold
      ? state.minimumTotalIdle
      : state.deploymentThreshold;

  return state.coinBalance > minIdle;
}

export function shouldReport(state: VaultState): boolean {
  if (state.isShutdown || state.paused) return false;
  if (state.totalStrategyWeight === 0n) return false;

  const secondsSinceReport = state.blockTimestamp - state.lastReport;
  return secondsSinceReport > BigInt(REPORT_INTERVAL_SECONDS);
}

// ---------------------------------------------------------------------------
// Single vault execution
// ---------------------------------------------------------------------------

async function invokeKeeperWrite(params: {
  vaultAddress: `0x${string}`;
  action: 'tend' | 'report';
}): Promise<WriteResult> {
  if (shouldUseKeeperHttpBridge()) {
    const bridge =
      params.action === 'tend'
        ? await postKeeperTend(params.vaultAddress)
        : await postKeeperReport(params.vaultAddress);
    return {
      txHash: (bridge.txHash ?? '0x0') as `0x${string}`,
      success: bridge.success,
      error: bridge.error,
    };
  }

  return writeContract({
    address: params.vaultAddress,
    abi: VAULT_ABI,
    functionName: params.action,
  });
}

/**
 * Execute keeper logic for a single vault.
 */
export async function executeKeeperForVault(vaultAddress: `0x${string}`): Promise<KeeperResult> {
  const state = await readVaultStateForAddress(vaultAddress);
  const shortAddr = `${vaultAddress.slice(0, 6)}...${vaultAddress.slice(-4)}`;

  // Guard: vault is shutdown or paused
  if (state.isShutdown) {
    console.log(`[${shortAddr}] Vault is shutdown — skipping`);
    return { vaultAddress, tended: false, reported: false, skippedReason: 'vault_shutdown' };
  }
  if (state.paused) {
    console.log(`[${shortAddr}] Vault is paused — skipping`);
    return { vaultAddress, tended: false, reported: false, skippedReason: 'vault_paused' };
  }

  const result: KeeperResult = { vaultAddress, tended: false, reported: false };

  // --- tend() ---
  if (shouldTend(state)) {
    console.log(`[${shortAddr}] Calling tend() — coinBalance: ${formatTokens(state.coinBalance)}`);

    const tendResult = await invokeKeeperWrite({ vaultAddress, action: 'tend' });

    result.tended = tendResult.success;
    result.tendResult = tendResult;

    if (tendResult.success) {
      console.log(`[${shortAddr}] tend() succeeded — tx: ${tendResult.txHash}`);
    } else {
      console.error(`[${shortAddr}] tend() failed — ${tendResult.error}`);
      await alertCritical(WORKFLOW_NAME, `tend() failed for ${shortAddr}`, {
        vaultAddress,
        error: tendResult.error,
      });
    }
  }

  // --- report() ---
  if (shouldReport(state)) {
    const secondsSinceReport = state.blockTimestamp - state.lastReport;
    console.log(`[${shortAddr}] Calling report() — ${Number(secondsSinceReport)}s since last report`);

    const reportResult = await invokeKeeperWrite({ vaultAddress, action: 'report' });

    result.reported = reportResult.success;
    result.reportResult = reportResult;

    if (reportResult.success) {
      console.log(`[${shortAddr}] report() succeeded — tx: ${reportResult.txHash}`);
    } else {
      console.error(`[${shortAddr}] report() failed — ${reportResult.error}`);
      await alertCritical(WORKFLOW_NAME, `report() failed for ${shortAddr}`, {
        vaultAddress,
        error: reportResult.error,
      });
    }
  }

  // Log if nothing to do
  if (!result.tended && !result.reported && !result.skippedReason) {
    const secondsSinceReport = state.blockTimestamp - state.lastReport;
    console.log(
      `[${shortAddr}] No action needed — ` +
        `coinBalance: ${formatTokens(state.coinBalance)}, ` +
        `lastReport: ${Number(secondsSinceReport)}s ago`
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Multi-vault execution
// ---------------------------------------------------------------------------

/**
 * Execute keeper logic for all vaults from the registry.
 * Falls back to single-vault mode if VAULT_ADDRESS is set.
 */
export async function executeKeeper(): Promise<BatchKeeperResult> {
  // Check for single-vault mode (backwards compatibility)
  const singleVault = process.env.VAULT_ADDRESS;
  if (singleVault && singleVault.startsWith('0x') && singleVault.length === 42) {
    console.log('Running in single-vault mode (VAULT_ADDRESS is set)');
    const result = await executeKeeperForVault(singleVault as `0x${string}`);
    return {
      totalVaults: 1,
      processed: 1,
      tended: result.tended ? 1 : 0,
      reported: result.reported ? 1 : 0,
      skipped: result.skippedReason ? 1 : 0,
      errors: 0,
      results: [result],
    };
  }

  // Multi-vault mode: fetch from registry
  console.log('Running in multi-vault mode (fetching from registry)');

  let vaults: VaultConfig[];
  try {
    const allVaults = await fetchActiveVaults(CHAINS.base.id);
    vaults = filterVaultsForWorkflow(allVaults, 'vault-keeper');
    console.log(`Found ${vaults.length} vaults to process`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Failed to fetch vaults from registry', { error: message });
    throw err;
  }

  if (vaults.length === 0) {
    console.log('No vaults found in registry');
    return {
      totalVaults: 0,
      processed: 0,
      tended: 0,
      reported: 0,
      skipped: 0,
      errors: 0,
      results: [],
    };
  }

  const batchResult: BatchKeeperResult = {
    totalVaults: vaults.length,
    processed: 0,
    tended: 0,
    reported: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  // Process vaults sequentially to avoid rate limits
  for (const vault of vaults) {
    try {
      const registryCheck = await verifyVaultRegistryBinding(vault);
      if (!registryCheck.verified) {
        const reason = registryCheck.reason ?? 'registry_verification_failed';
        console.warn(`[${vault.vaultAddress}] Skipping due to registry verification: ${reason}`);
        batchResult.results.push({
          vaultAddress: vault.vaultAddress,
          tended: false,
          reported: false,
          skippedReason: `registry_unverified: ${reason}`,
        });
        batchResult.processed++;
        batchResult.skipped++;
        continue;
      }

      const result = await executeKeeperForVault(vault.vaultAddress);
      batchResult.results.push(result);
      batchResult.processed++;

      if (result.tended) batchResult.tended++;
      if (result.reported) batchResult.reported++;
      if (result.skippedReason) batchResult.skipped++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${vault.vaultAddress}] Error: ${message}`);
      batchResult.errors++;
      batchResult.results.push({
        vaultAddress: vault.vaultAddress,
        tended: false,
        reported: false,
        skippedReason: `error: ${message}`,
      });
    }
  }

  // Summary alert
  if (batchResult.tended > 0 || batchResult.reported > 0) {
    await alertInfo(WORKFLOW_NAME, 'Batch complete', {
      totalVaults: batchResult.totalVaults,
      tended: batchResult.tended,
      reported: batchResult.reported,
      skipped: batchResult.skipped,
      errors: batchResult.errors,
    });
  }

  return batchResult;
}

// ---------------------------------------------------------------------------
// Legacy exports for backwards compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use readVaultStateForAddress instead */
export async function readVaultState(): Promise<VaultState> {
  const vaultAddress = process.env.VAULT_ADDRESS as `0x${string}`;
  if (!vaultAddress) {
    throw new Error('VAULT_ADDRESS not set');
  }
  return readVaultStateForAddress(vaultAddress);
}
