/**
 * Vault strategy reallocator — cross-strategy TVL convergence via rebalanceStrategies().
 *
 * Reads strategy NAV + weights, plans drift off target allocation, and calls the
 * on-chain keeper entrypoint when overweight drift exceeds the configured band.
 */

import { getAddress, isAddress } from 'viem';
import {
  CHAINS,
  VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS,
  VAULT_STRATEGY_VIEW_ABI,
  VAULT_ABI,
} from '../config.js';
import {
  computeDeployableBase,
  computeMinIdle,
  computeStrategyAllocationPlan,
  shouldRebalanceStrategies,
  type StrategyAllocationSnapshot,
} from '../utils/strategyAllocation.js';
import { readContract, writeContract, type WriteResult } from '../utils/onchain.js';
import {
  postKeeperRebalanceStrategies,
  shouldUseKeeperHttpBridge,
} from '../utils/keeperHttpBridge.js';
import { alertCritical, alertInfo } from '../utils/alerts.js';
import {
  fetchActiveVaults,
  filterVaultsForWorkflow,
  verifyVaultRegistryBinding,
  type VaultConfig,
} from '../utils/registry.js';

const WORKFLOW_NAME = 'vault-strategy-reallocator';
const MAX_STRATEGIES = 5;

const STRATEGY_ASSETS_ABI = [
  {
    type: 'function',
    name: 'getTotalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export type VaultStrategyAllocationState = {
  vaultAddress: `0x${string}`;
  coinBalance: bigint;
  deploymentThreshold: bigint;
  minimumTotalIdle: bigint;
  totalStrategyWeight: bigint;
  totalAssets: bigint;
  deployableBase: bigint;
  minIdle: bigint;
  defaultQueue: `0x${string}`[];
  useDefaultQueue: boolean;
  strategies: StrategyAllocationSnapshot[];
  isShutdown: boolean;
  paused: boolean;
};

export type VaultStrategyReallocateResult = {
  vaultAddress: `0x${string}`;
  rebalanced: boolean;
  skippedReason?: string;
  txHash?: `0x${string}`;
  plan?: ReturnType<typeof computeStrategyAllocationPlan>;
  error?: string;
};

export type BatchVaultStrategyReallocateResult = {
  totalVaults: number;
  processed: number;
  rebalanced: number;
  skipped: number;
  errors: number;
  results: VaultStrategyReallocateResult[];
};

function parseMinDeviationBps(): bigint {
  const raw = Number(process.env.VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS ?? VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS);
  if (!Number.isFinite(raw) || raw < 0) return BigInt(VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS);
  return BigInt(Math.min(10_000, Math.floor(raw)));
}

async function readDefaultQueue(vaultAddress: `0x${string}`): Promise<`0x${string}`[]> {
  const queue: `0x${string}`[] = [];
  for (let i = 0; i < MAX_STRATEGIES; i++) {
    try {
      const entry = await readContract<`0x${string}`>({
        address: vaultAddress,
        abi: VAULT_STRATEGY_VIEW_ABI,
        functionName: 'defaultQueue',
        args: [BigInt(i)],
      });
      if (!entry || entry === '0x0000000000000000000000000000000000000000') break;
      queue.push(getAddress(entry));
    } catch {
      break;
    }
  }
  return queue;
}

async function readStrategySnapshots(vaultAddress: `0x${string}`): Promise<StrategyAllocationSnapshot[]> {
  const strategies: StrategyAllocationSnapshot[] = [];

  for (let i = 0; i < MAX_STRATEGIES; i++) {
    let strategy: `0x${string}`;
    try {
      strategy = getAddress(
        await readContract<`0x${string}`>({
          address: vaultAddress,
          abi: VAULT_STRATEGY_VIEW_ABI,
          functionName: 'strategyList',
          args: [BigInt(i)],
        }),
      );
    } catch {
      break;
    }

    const [weightBps, strategyDebt, actualAssets] = await Promise.all([
      readContract<bigint>({
        address: vaultAddress,
        abi: VAULT_STRATEGY_VIEW_ABI,
        functionName: 'strategyWeights',
        args: [strategy],
      }),
      readContract<bigint>({
        address: vaultAddress,
        abi: VAULT_STRATEGY_VIEW_ABI,
        functionName: 'strategyDebt',
        args: [strategy],
      }),
      readContract<bigint>({
        address: strategy,
        abi: STRATEGY_ASSETS_ABI,
        functionName: 'getTotalAssets',
      }).catch(async () =>
        readContract<bigint>({
          address: vaultAddress,
          abi: VAULT_STRATEGY_VIEW_ABI,
          functionName: 'strategyDebt',
          args: [strategy],
        }),
      ),
    ]);

    if (weightBps > 0n) {
      strategies.push({
        address: strategy,
        weightBps,
        actualAssets,
        strategyDebt,
      });
    }
  }

  return strategies;
}

export async function readVaultStrategyAllocationState(
  vaultAddress: `0x${string}`,
): Promise<VaultStrategyAllocationState> {
  const [
    coinBalance,
    deploymentThreshold,
    minimumTotalIdle,
    totalStrategyWeight,
    totalAssets,
    isShutdown,
    paused,
    useDefaultQueue,
    defaultQueue,
    strategies,
  ] = await Promise.all([
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'coinBalance' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'deploymentThreshold' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'minimumTotalIdle' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'totalStrategyWeight' }),
    readContract<bigint>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'totalAssets' }),
    readContract<boolean>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'isShutdown' }),
    readContract<boolean>({ address: vaultAddress, abi: VAULT_ABI, functionName: 'paused' }),
    readContract<boolean>({
      address: vaultAddress,
      abi: VAULT_STRATEGY_VIEW_ABI,
      functionName: 'useDefaultQueue',
    }).catch(() => false),
    readDefaultQueue(vaultAddress),
    readStrategySnapshots(vaultAddress),
  ]);

  const minIdle = computeMinIdle({ minimumTotalIdle, deploymentThreshold });
  const deployableBase = computeDeployableBase({
    strategies,
    coinBalance,
    minimumTotalIdle,
    deploymentThreshold,
    totalStrategyWeight,
    minDeviationBps: 0n,
  });

  return {
    vaultAddress,
    coinBalance,
    deploymentThreshold,
    minimumTotalIdle,
    totalStrategyWeight,
    totalAssets,
    deployableBase,
    minIdle,
    defaultQueue,
    useDefaultQueue,
    strategies,
    isShutdown,
    paused,
  };
}

export function shouldRebalanceVaultState(
  state: VaultStrategyAllocationState,
  minDeviationBps = parseMinDeviationBps(),
): boolean {
  if (state.isShutdown || state.paused) return false;
  if (state.totalStrategyWeight === 0n || state.strategies.length < 2) return false;

  const plan = computeStrategyAllocationPlan({
    strategies: state.strategies,
    coinBalance: state.coinBalance,
    minimumTotalIdle: state.minimumTotalIdle,
    deploymentThreshold: state.deploymentThreshold,
    totalStrategyWeight: state.totalStrategyWeight,
    minDeviationBps,
  });

  return shouldRebalanceStrategies(plan);
}

async function invokeRebalanceWrite(params: {
  vaultAddress: `0x${string}`;
  minDeviationBps: bigint;
}): Promise<WriteResult> {
  if (shouldUseKeeperHttpBridge()) {
    return postKeeperRebalanceStrategies(params.vaultAddress, params.minDeviationBps);
  }

  return writeContract({
    address: params.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'rebalanceStrategies',
    args: [params.minDeviationBps],
  });
}

export async function executeVaultStrategyReallocatorForVault(
  vaultAddress: `0x${string}`,
): Promise<VaultStrategyReallocateResult> {
  const minDeviationBps = parseMinDeviationBps();
  const state = await readVaultStrategyAllocationState(vaultAddress);
  const shortAddr = `${vaultAddress.slice(0, 6)}...${vaultAddress.slice(-4)}`;

  if (state.isShutdown) {
    return { vaultAddress, rebalanced: false, skippedReason: 'vault_shutdown' };
  }
  if (state.paused) {
    return { vaultAddress, rebalanced: false, skippedReason: 'vault_paused' };
  }
  if (state.strategies.length < 2) {
    return { vaultAddress, rebalanced: false, skippedReason: 'single_strategy_vault' };
  }

  const plan = computeStrategyAllocationPlan({
    strategies: state.strategies,
    coinBalance: state.coinBalance,
    minimumTotalIdle: state.minimumTotalIdle,
    deploymentThreshold: state.deploymentThreshold,
    totalStrategyWeight: state.totalStrategyWeight,
    minDeviationBps,
  });

  if (!shouldRebalanceStrategies(plan)) {
    console.log(`[${shortAddr}] No cross-strategy drift above ${minDeviationBps} bps`);
    return { vaultAddress, rebalanced: false, skippedReason: 'within_deviation_band', plan };
  }

  console.log(
    `[${shortAddr}] Calling rebalanceStrategies(${minDeviationBps}) — queue=${state.defaultQueue.join(',')}`,
  );

  const writeResult = await invokeRebalanceWrite({ vaultAddress, minDeviationBps });
  if (!writeResult.success) {
    await alertCritical(WORKFLOW_NAME, `rebalanceStrategies failed for ${shortAddr}`, {
      vaultAddress,
      error: writeResult.error,
    });
    return {
      vaultAddress,
      rebalanced: false,
      plan,
      error: writeResult.error,
    };
  }

  await alertInfo(WORKFLOW_NAME, `rebalanceStrategies succeeded for ${shortAddr}`, {
    vaultAddress,
    txHash: writeResult.txHash,
  });

  return {
    vaultAddress,
    rebalanced: true,
    txHash: writeResult.txHash,
    plan,
  };
}

export async function executeVaultStrategyReallocator(): Promise<BatchVaultStrategyReallocateResult> {
  const singleVault = process.env.VAULT_ADDRESS;
  if (singleVault && isAddress(singleVault)) {
    const result = await executeVaultStrategyReallocatorForVault(getAddress(singleVault));
    return {
      totalVaults: 1,
      processed: 1,
      rebalanced: result.rebalanced ? 1 : 0,
      skipped: result.skippedReason ? 1 : 0,
      errors: result.error ? 1 : 0,
      results: [result],
    };
  }

  const allVaults = await fetchActiveVaults(CHAINS.base.id);
  const vaults = filterVaultsForWorkflow(allVaults, 'vault-strategy-reallocator');

  const batch: BatchVaultStrategyReallocateResult = {
    totalVaults: vaults.length,
    processed: 0,
    rebalanced: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  for (const vault of vaults) {
    try {
      const registryCheck = await verifyVaultRegistryBinding(vault);
      if (!registryCheck.verified) {
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          rebalanced: false,
          skippedReason: `registry_unverified:${registryCheck.reason ?? 'unknown'}`,
        });
        batch.processed++;
        batch.skipped++;
        continue;
      }

      const result = await executeVaultStrategyReallocatorForVault(vault.vaultAddress);
      batch.results.push(result);
      batch.processed++;
      if (result.rebalanced) batch.rebalanced++;
      if (result.skippedReason) batch.skipped++;
      if (result.error) batch.errors++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      batch.errors++;
      batch.results.push({
        vaultAddress: vault.vaultAddress,
        rebalanced: false,
        error: message,
      });
    }
  }

  return batch;
}
