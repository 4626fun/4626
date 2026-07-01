/**
 * Payout Router Harvest — claims protocol rewards and converts routed balances into vault shares.
 *
 * Per vault (when payoutRouterAddress is configured):
 *   1) Optionally claim protocol rewards into the router (claimAllProtocolRewards)
 *   2) Plan all token conversions and execute via processBatch (single tx)
 *   3) Optionally checkpoint the burn stream
 */

import { CHAINS } from '../config.js';
import { readContract, writeContract, type WriteResult } from '../utils/onchain.js';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';
import {
  fetchActiveVaults,
  filterVaultsForWorkflow,
  verifyVaultRegistryBinding,
  type VaultConfig,
} from '../utils/registry.js';
import {
  PAYOUT_ROUTER_HARVEST_ABI,
  parseHarvestBoolEnv,
  parseHarvestBpsEnv,
  planPayoutRouterHarvestConversions,
} from '../utils/payoutRouterHarvestPlan.js';
import {
  executePlannedHarvestConversions,
  parseHarvestPerTokenFallbackEnv,
} from '../utils/payoutRouterHarvestExecute.js';
import { buildPayoutRouterHarvestTokenPlan } from '../utils/payoutRouterHarvestTokens.js';
import { maybeExecutePayoutRouterTreasurySetup } from '../utils/payoutRouterTreasurySetupClient.js';

const WORKFLOW_NAME = 'payout-router-harvest';

const PAYOUT_ROUTER_SWAP_PATH_ABI = [
  {
    type: 'function',
    name: 'swapPathToShareOFT',
    stateMutability: 'view',
    inputs: [{ name: 'tokenIn', type: 'address' }],
    outputs: [{ type: 'bytes' }],
  },
] as const;

const PAYOUT_ROUTER_ABI = [
  ...PAYOUT_ROUTER_HARVEST_ABI,
  {
    type: 'function',
    name: 'protocolRewardsClaimable',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimAllProtocolRewards',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'shareOFT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

const BURN_STREAM_CHECKPOINT_ABI = [
  {
    type: 'function',
    name: 'checkpoint',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export interface RouterTokenResult {
  token: `0x${string}`;
  label: 'creatorCoin' | 'ZORA' | 'WETH' | 'USDC' | string;
  balance: bigint;
  converted: boolean;
  route?: 'v3' | 'external' | 'direct';
  txHash?: `0x${string}`;
  error?: string;
  skippedReason?: string;
}

export interface RouterVaultResult {
  vaultAddress: `0x${string}`;
  payoutRouterAddress: `0x${string}`;
  claimedProtocolRewards: boolean;
  claimableBefore: bigint;
  claimResult?: WriteResult;
  batchTxHash?: `0x${string}`;
  tokens: RouterTokenResult[];
  skippedReason?: string;
}

export interface BatchPayoutRouterHarvestResult {
  totalVaults: number;
  processed: number;
  claimedVaults: number;
  converted: number;
  skipped: number;
  errors: number;
  results: RouterVaultResult[];
}

function parseBigIntEnv(key: string, fallback: bigint): bigint {
  const raw = String(process.env[key] ?? '').trim();
  if (!raw) return fallback;
  try {
    const parsed = BigInt(raw);
    return parsed >= 0n ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function short(addr: `0x${string}`): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function executePayoutRouterHarvest(): Promise<BatchPayoutRouterHarvestResult> {
  const processWeth = parseHarvestBoolEnv('PAYOUT_ROUTER_PROCESS_WETH', true);
  const claimProtocolRewards = parseHarvestBoolEnv('PAYOUT_ROUTER_CLAIM_PROTOCOL_REWARDS', true);
  const allowExternalSwaps = parseHarvestBoolEnv('PAYOUT_ROUTER_ALLOW_EXTERNAL_SWAPS', false);
  const preferExternalSwaps = parseHarvestBoolEnv('PAYOUT_ROUTER_PREFER_EXTERNAL_SWAPS', false);
  const externalSwapSlippageBps = parseHarvestBpsEnv('PAYOUT_ROUTER_EXTERNAL_SWAP_SLIPPAGE_BPS', 100);

  const minBalance = parseBigIntEnv('PAYOUT_ROUTER_MIN_BALANCE_WEI', 0n);
  const minOutDefault = parseBigIntEnv('PAYOUT_ROUTER_MIN_OUT_WEI', parseBigIntEnv('PAYOUT_ROUTER_MIN_CREATOR_OUT_WEI', 0n));
  const minOutZora = parseBigIntEnv('PAYOUT_ROUTER_MIN_OUT_ZORA_WEI', parseBigIntEnv('PAYOUT_ROUTER_MIN_CREATOR_OUT_ZORA_WEI', minOutDefault));
  const minOutWeth = parseBigIntEnv('PAYOUT_ROUTER_MIN_OUT_WETH_WEI', parseBigIntEnv('PAYOUT_ROUTER_MIN_CREATOR_OUT_WETH_WEI', minOutDefault));
  const minOutUsdc = parseBigIntEnv('PAYOUT_ROUTER_MIN_OUT_USDC_WEI', parseBigIntEnv('PAYOUT_ROUTER_MIN_CREATOR_OUT_USDC_WEI', minOutDefault));

  let vaults: VaultConfig[];
  try {
    const allVaults = await fetchActiveVaults(CHAINS.base.id);
    vaults = filterVaultsForWorkflow(allVaults, 'payout-router-harvest');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Failed to fetch vaults from registry', { error: message });
    throw err;
  }

  const batch: BatchPayoutRouterHarvestResult = {
    totalVaults: vaults.length,
    processed: 0,
    claimedVaults: 0,
    converted: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  for (const vault of vaults) {
    const payoutRouterAddress = vault.payoutRouterAddress;
    const creatorCoin = vault.creatorCoinAddress;

    if (!payoutRouterAddress || !creatorCoin) {
      batch.skipped += 1;
      batch.results.push({
        vaultAddress: vault.vaultAddress,
        payoutRouterAddress: (payoutRouterAddress || '0x0000000000000000000000000000000000000000') as `0x${string}`,
        claimedProtocolRewards: false,
        claimableBefore: 0n,
        tokens: [],
        skippedReason: 'missing_router_or_creator_coin',
      });
      continue;
    }

    const verification = await verifyVaultRegistryBinding(vault);
    if (!verification.verified) {
      batch.skipped += 1;
      batch.results.push({
        vaultAddress: vault.vaultAddress,
        payoutRouterAddress,
        claimedProtocolRewards: false,
        claimableBefore: 0n,
        tokens: [],
        skippedReason: `registry_unverified:${verification.reason ?? 'unknown'}`,
      });
      continue;
    }

    const shareOft = await readContract<`0x${string}`>({
      address: payoutRouterAddress,
      abi: PAYOUT_ROUTER_ABI,
      functionName: 'shareOFT',
    });

    const tokenPlan = buildPayoutRouterHarvestTokenPlan({
      creatorCoin,
      processWeth,
      minOutZora,
      minOutWeth,
      minOutUsdc,
    });

    const dedupedTokenPlan = tokenPlan;

    const result: RouterVaultResult = {
      vaultAddress: vault.vaultAddress,
      payoutRouterAddress,
      claimedProtocolRewards: false,
      claimableBefore: 0n,
      tokens: [],
    };

    try {
      let treasurySetupAttempted = false
      const readSwapPath = async (tokenIn: `0x${string}`): Promise<`0x${string}`> => {
        const path = await readContract<`0x${string}`>({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_SWAP_PATH_ABI,
          functionName: 'swapPathToShareOFT',
          args: [tokenIn],
        })
        if (path && path !== '0x') return path
        if (treasurySetupAttempted) return '0x'
        treasurySetupAttempted = true
        const setup = await maybeExecutePayoutRouterTreasurySetup({
          payoutRouter: payoutRouterAddress,
          creatorToken: creatorCoin,
        })
        console.info(`[${short(vault.vaultAddress)}] payout_router.treasury_auto_setup`, setup)
        if (!setup.executed) return '0x'
        return readContract<`0x${string}`>({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_SWAP_PATH_ABI,
          functionName: 'swapPathToShareOFT',
          args: [tokenIn],
        }).catch(() => '0x' as `0x${string}`)
      }

      if (claimProtocolRewards) {
        try {
          const claimableBefore = await readContract<bigint>({
            address: payoutRouterAddress,
            abi: PAYOUT_ROUTER_ABI,
            functionName: 'protocolRewardsClaimable',
          });
          result.claimableBefore = claimableBefore;

          if (claimableBefore > 0n) {
            const claimResult = await writeContract({
              address: payoutRouterAddress,
              abi: PAYOUT_ROUTER_ABI,
              functionName: 'claimAllProtocolRewards',
            });
            result.claimResult = claimResult;
            result.claimedProtocolRewards = claimResult.success;
            if (claimResult.success) {
              batch.claimedVaults += 1;
            }
          }
        } catch (err) {
          result.claimResult = {
            txHash: '0x0' as `0x${string}`,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      const { conversions, skipped } = await planPayoutRouterHarvestConversions({
        payoutRouterAddress,
        shareOft,
        tokenPlan: dedupedTokenPlan,
        minBalance,
        allowExternalSwaps,
        preferExternalSwaps,
        externalSwapSlippageBps,
        resolveSwapPath: readSwapPath,
      });

      for (const entry of skipped) {
        result.tokens.push({
          token: entry.token,
          label: entry.label,
          balance: entry.balance,
          converted: false,
          skippedReason: entry.skippedReason,
        });
      }

      let batchSucceeded = false
      if (conversions.length > 0) {
        const execution = await executePlannedHarvestConversions({
          conversions,
          perTokenFallback: parseHarvestPerTokenFallbackEnv(),
          submitBatch: async (actions) => {
            const batchResult = await writeContract({
              address: payoutRouterAddress,
              abi: PAYOUT_ROUTER_ABI,
              functionName: 'processBatch',
              args: [actions],
            });
            return {
              success: batchResult.success,
              txHash: batchResult.success ? batchResult.txHash : undefined,
              error: batchResult.success ? undefined : batchResult.error,
            };
          },
        });

        result.batchTxHash = execution.primaryBatchTxHash ?? execution.converted[0]?.txHash;

        for (const success of execution.converted) {
          result.tokens.push({
            token: success.conversion.token,
            label: success.conversion.label,
            balance: success.conversion.balance,
            converted: true,
            route: success.conversion.route,
            txHash: success.txHash ?? execution.primaryBatchTxHash,
          });
        }

        for (const failure of execution.failed) {
          result.tokens.push({
            token: failure.conversion.token,
            label: failure.conversion.label,
            balance: failure.conversion.balance,
            converted: false,
            route: failure.conversion.route,
            error: failure.error,
          });
        }

        if (execution.converted.length > 0) {
          batchSucceeded = true;
          batch.converted += execution.converted.length;
          console.log(
            `[${short(vault.vaultAddress)}] processBatch converted ${execution.converted.length}/${conversions.length}` +
              (execution.usedPerTokenFallback ? ' via per-token fallback' : ''),
          );
        }

        if (execution.failed.length > 0) {
          batch.errors += execution.failed.length;
          console.error(
            `[${short(vault.vaultAddress)}] processBatch failed for ${execution.failed.length} token(s)`,
          );
        }
      }

      if (
        batchSucceeded &&
        parseHarvestBoolEnv('PAYOUT_ROUTER_DRIP_BURN_STREAM', true) &&
        vault.burnStreamAddress
      ) {
        const dripResult = await writeContract({
          address: vault.burnStreamAddress,
          abi: BURN_STREAM_CHECKPOINT_ABI,
          functionName: 'checkpoint',
          args: [],
        });
        if (dripResult.success) {
          console.log(`[${short(vault.vaultAddress)}] burn stream checkpoint succeeded; tx=${dripResult.txHash ?? 'n/a'}`);
        } else {
          console.warn(
            `[${short(vault.vaultAddress)}] burn stream checkpoint failed: ${dripResult.error ?? 'unknown'}`,
          );
        }
      }

      batch.processed += 1;
      batch.results.push(result);
    } catch (err) {
      batch.processed += 1;
      batch.errors += 1;
      batch.results.push({
        ...result,
        skippedReason: `error:${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  if (batch.converted > 0 || batch.claimedVaults > 0) {
    await alertInfo(WORKFLOW_NAME, 'Payout router harvest complete', {
      totalVaults: batch.totalVaults,
      processed: batch.processed,
      claimedVaults: batch.claimedVaults,
      converted: batch.converted,
      errors: batch.errors,
      skipped: batch.skipped,
    });
  } else if (batch.errors > 0) {
    await alertWarning(WORKFLOW_NAME, 'Payout router harvest completed with errors', {
      totalVaults: batch.totalVaults,
      processed: batch.processed,
      claimedVaults: batch.claimedVaults,
      converted: batch.converted,
      errors: batch.errors,
      skipped: batch.skipped,
    });
  }

  return batch;
}
