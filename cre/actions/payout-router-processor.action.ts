/**
 * Payout Router Processor — claims protocol rewards and converts routed balances into vault shares.
 *
 * Per vault (when payoutRouterAddress is configured):
 *   1) Optionally claim protocol rewards into the router (claimAllProtocolRewards)
 *   2) Run convertAndQueue for creatorCoin
 *   3) Run convertAndQueue for ZORA
 *   4) Optionally run convertAndQueue for WETH (to process claimed protocol rewards)
 */

import { CHAINS } from '../config.js';
import { readContract, writeContract, type WriteResult } from '../utils/onchain.js';
import { alertCritical, alertInfo, alertWarning, formatTokens } from '../utils/alerts.js';
import {
  fetchActiveVaults,
  filterVaultsForWorkflow,
  verifyVaultRegistryBinding,
  type VaultConfig,
} from '../utils/registry.js';

const WORKFLOW_NAME = 'payout-router-processor';

const DEFAULT_ZORA_TOKEN = '0x4200000000000000000000000000000000000777' as const;
const DEFAULT_WETH = '0x4200000000000000000000000000000000000006' as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const PAYOUT_ROUTER_ABI = [
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
    name: 'convertAndQueue',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minCreatorOut', type: 'uint256' },
    ],
    outputs: [
      { name: 'creatorOut', type: 'uint256' },
      { name: 'sharesQueued', type: 'uint256' },
    ],
  },
] as const;

export interface RouterTokenResult {
  token: `0x${string}`;
  label: 'creatorCoin' | 'ZORA' | 'WETH';
  balance: bigint;
  converted: boolean;
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
  tokens: RouterTokenResult[];
  skippedReason?: string;
}

export interface BatchPayoutRouterResult {
  totalVaults: number;
  processed: number;
  claimedVaults: number;
  converted: number;
  skipped: number;
  errors: number;
  results: RouterVaultResult[];
}

function parseBoolEnv(key: string, fallback: boolean): boolean {
  const raw = String(process.env[key] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return fallback;
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

export async function executePayoutRouterProcessor(): Promise<BatchPayoutRouterResult> {
  const zoraToken = (process.env.ZORA_TOKEN?.trim() || DEFAULT_ZORA_TOKEN) as `0x${string}`;
  const wethToken = (process.env.WETH?.trim() || DEFAULT_WETH) as `0x${string}`;
  const claimProtocolRewards = parseBoolEnv('PAYOUT_ROUTER_CLAIM_PROTOCOL_REWARDS', true);
  const processWeth = parseBoolEnv('PAYOUT_ROUTER_PROCESS_WETH', true);

  const minBalance = parseBigIntEnv('PAYOUT_ROUTER_MIN_BALANCE_WEI', 0n);
  const minCreatorOutDefault = parseBigIntEnv('PAYOUT_ROUTER_MIN_CREATOR_OUT_WEI', 0n);
  const minCreatorOutZora = parseBigIntEnv('PAYOUT_ROUTER_MIN_CREATOR_OUT_ZORA_WEI', minCreatorOutDefault);
  const minCreatorOutWeth = parseBigIntEnv('PAYOUT_ROUTER_MIN_CREATOR_OUT_WETH_WEI', minCreatorOutDefault);

  let vaults: VaultConfig[];
  try {
    const allVaults = await fetchActiveVaults(CHAINS.base.id);
    vaults = filterVaultsForWorkflow(allVaults, 'payout-router-processor');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Failed to fetch vaults from registry', { error: message });
    throw err;
  }

  const batch: BatchPayoutRouterResult = {
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

    const tokenPlan: Array<{
      token: `0x${string}`;
      label: RouterTokenResult['label'];
      minCreatorOut: bigint;
    }> = [
      { token: creatorCoin, label: 'creatorCoin', minCreatorOut: 0n },
      { token: zoraToken, label: 'ZORA', minCreatorOut: minCreatorOutZora },
      ...(processWeth ? [{ token: wethToken, label: 'WETH' as const, minCreatorOut: minCreatorOutWeth }] : []),
    ];

    const dedupedTokenPlan = tokenPlan.filter((entry, index, all) => {
      return all.findIndex((candidate) => candidate.token.toLowerCase() === entry.token.toLowerCase()) === index;
    });

    const result: RouterVaultResult = {
      vaultAddress: vault.vaultAddress,
      payoutRouterAddress,
      claimedProtocolRewards: false,
      claimableBefore: 0n,
      tokens: [],
    };

    try {
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

      for (const token of dedupedTokenPlan) {
        const balance = await readContract<bigint>({
          address: token.token,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [payoutRouterAddress],
        });

        if (balance <= minBalance) {
          result.tokens.push({
            token: token.token,
            label: token.label,
            balance,
            converted: false,
            skippedReason: 'balance_below_threshold',
          });
          continue;
        }

        const convertResult = await writeContract({
          address: payoutRouterAddress,
          abi: PAYOUT_ROUTER_ABI,
          functionName: 'convertAndQueue',
          args: [token.token, balance, token.minCreatorOut],
        });

        result.tokens.push({
          token: token.token,
          label: token.label,
          balance,
          converted: convertResult.success,
          txHash: convertResult.success ? convertResult.txHash : undefined,
          error: convertResult.success ? undefined : convertResult.error,
        });

        if (convertResult.success) {
          batch.converted += 1;
          console.log(
            `[${short(vault.vaultAddress)}] convertAndQueue(${token.label}) succeeded; amount=${formatTokens(balance, token.label)}`,
          );
        } else {
          batch.errors += 1;
          console.error(
            `[${short(vault.vaultAddress)}] convertAndQueue(${token.label}) failed: ${convertResult.error ?? 'unknown'}`,
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
    await alertInfo(WORKFLOW_NAME, 'Payout router processing complete', {
      totalVaults: batch.totalVaults,
      processed: batch.processed,
      claimedVaults: batch.claimedVaults,
      converted: batch.converted,
      errors: batch.errors,
      skipped: batch.skipped,
    });
  } else if (batch.errors > 0) {
    await alertWarning(WORKFLOW_NAME, 'Payout router processing completed with errors', {
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
