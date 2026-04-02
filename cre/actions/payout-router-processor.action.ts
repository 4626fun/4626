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

const DEFAULT_ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69' as const;
const DEFAULT_WETH = '0x4200000000000000000000000000000000000006' as const;
const DEFAULT_DEFILLAMA_API_BASE = 'https://api.llama.fi' as const;
const EXTERNAL_QUOTE_TIMEOUT_MS = 15_000;

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
  {
    type: 'function',
    name: 'convertViaExternalAndQueue',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'minCreatorOut', type: 'uint256' },
          { name: 'spender', type: 'address' },
          { name: 'swapTarget', type: 'address' },
          { name: 'swapCallData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'creatorOut', type: 'uint256' },
      { name: 'sharesQueued', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapTargets',
    stateMutability: 'view',
    inputs: [{ name: 'target', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approvedExternalSwapSpenders',
    stateMutability: 'view',
    inputs: [{ name: 'spender', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'swapPathToCreator',
    stateMutability: 'view',
    inputs: [{ name: 'tokenIn', type: 'address' }],
    outputs: [{ type: 'bytes' }],
  },
] as const;

export interface RouterTokenResult {
  token: `0x${string}`;
  label: 'creatorCoin' | 'ZORA' | 'WETH';
  balance: bigint;
  converted: boolean;
  route?: 'v3' | 'external';
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

function parseBpsEnv(key: string, fallback: number): number {
  const raw = String(process.env[key] ?? '').trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  if (parsed < 1 || parsed > 5_000) return fallback;
  return parsed;
}

function normalizeAddressMaybe(value: string): `0x${string}` | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(raw)) return null;
  return raw as `0x${string}`;
}

function parseAddressListEnv(key: string): Array<`0x${string}`> {
  const raw = String(process.env[key] ?? '').trim();
  if (!raw) return [];
  const out: Array<`0x${string}`> = [];
  for (const token of raw.split(',').map((s) => s.trim())) {
    const normalized = normalizeAddressMaybe(token);
    if (normalized) out.push(normalized);
  }
  return out;
}

function resolveZoraTokens(): Array<`0x${string}`> {
  const primary =
    normalizeAddressMaybe(String(process.env.PAYOUT_ROUTER_ZORA_TOKEN ?? '')) ??
    normalizeAddressMaybe(String(process.env.ZORA_TOKEN ?? '')) ??
    (DEFAULT_ZORA_TOKEN as `0x${string}`);
  const fallback = parseAddressListEnv('PAYOUT_ROUTER_ZORA_TOKEN_FALLBACKS');

  const out: Array<`0x${string}`> = [];
  const seen = new Set<string>();
  for (const token of [primary, ...fallback]) {
    const normalized = normalizeAddressMaybe(token) ?? token;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function short(addr: `0x${string}`): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHexData(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) && value !== '0x';
}

function parseJsonText(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 1_000) };
  }
}

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; payload: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_QUOTE_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    return { status: response.status, payload: parseJsonText(raw) };
  } catch (error: any) {
    const aborted = String(error?.name ?? '').toLowerCase() === 'aborterror';
    return {
      status: aborted ? 504 : 502,
      payload: { error: aborted ? 'upstream_timeout' : String(error?.message ?? 'upstream_unreachable') },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractSwapTransaction(
  payload: unknown,
  fallbackFrom: `0x${string}`,
): { to: `0x${string}`; from: `0x${string}`; data: `0x${string}`; value: string } | null {
  if (!isObject(payload)) return null;

  let candidate: Record<string, unknown> | null = null;
  for (const key of ['transaction', 'tx', 'swap'] as const) {
    const value = payload[key];
    if (isObject(value)) {
      candidate = value as Record<string, unknown>;
      break;
    }
  }
  if (!candidate && isObject(payload.route)) {
    const routeObj = payload.route as Record<string, unknown>;
    if (isObject(routeObj.tx)) candidate = routeObj.tx as Record<string, unknown>;
    else if (isObject(routeObj.transaction)) candidate = routeObj.transaction as Record<string, unknown>;
  }
  if (!candidate && typeof payload.to === 'string' && payload.data != null) {
    candidate = payload as Record<string, unknown>;
  }
  if (!candidate) return null;

  const to = normalizeAddressMaybe(String(candidate.to ?? ''));
  const from = normalizeAddressMaybe(String(candidate.from ?? '')) ?? fallbackFrom;
  const data = candidate.data;
  const value = candidate.value == null ? '0' : String(candidate.value);
  if (!to || !from || !isHexData(data)) return null;

  return { to, from, data, value };
}

function readDefiLlamaApiBase(): string {
  const raw = String(process.env.DEFILLAMA_SWAP_API_BASE ?? '').trim();
  return raw ? raw.replace(/\/+$/, '') : DEFAULT_DEFILLAMA_API_BASE;
}

type DefiLlamaExternalQuote = {
  swapTarget: `0x${string}`;
  spender: `0x${string}`;
  swapCallData: `0x${string}`;
  error?: string;
};

async function fetchDefiLlamaExternalQuote(params: {
  payoutRouterAddress: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  slippageBps: number;
}): Promise<DefiLlamaExternalQuote | null> {
  const quoteRequest = {
    chain: 'base',
    from: params.tokenIn,
    to: params.tokenOut,
    amount: params.amountIn.toString(),
    fromAddress: params.payoutRouterAddress,
    slippage: (params.slippageBps / 100).toString(),
  };

  const url = new URL(`${readDefiLlamaApiBase()}/swap/quote`);
  for (const [key, value] of Object.entries(quoteRequest)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = String(process.env.DEFILLAMA_API_KEY ?? '').trim();
  if (apiKey) headers['x-api-key'] = apiKey;

  const upstream = await fetchJson(url.toString(), { method: 'GET', headers });
  if (upstream.status >= 400) {
    return { swapTarget: params.payoutRouterAddress, spender: params.payoutRouterAddress, swapCallData: '0x', error: String((upstream.payload as any)?.error ?? `http_${upstream.status}`) };
  }

  const tx = extractSwapTransaction(upstream.payload, params.payoutRouterAddress);
  if (!tx) {
    return {
      swapTarget: params.payoutRouterAddress,
      spender: params.payoutRouterAddress,
      swapCallData: '0x',
      error: 'defillama_missing_swap_tx',
    };
  }

  const payloadObj = isObject(upstream.payload) ? (upstream.payload as Record<string, unknown>) : {};
  const spender =
    normalizeAddressMaybe(String(payloadObj.allowanceTarget ?? '')) ??
    normalizeAddressMaybe(String(payloadObj.approvalAddress ?? '')) ??
    normalizeAddressMaybe(String(payloadObj.spender ?? '')) ??
    tx.to;

  return {
    swapTarget: tx.to,
    spender,
    swapCallData: tx.data,
  };
}

export async function executePayoutRouterProcessor(): Promise<BatchPayoutRouterResult> {
  const zoraTokens = resolveZoraTokens();
  const wethToken = (process.env.WETH?.trim() || DEFAULT_WETH) as `0x${string}`;
  const claimProtocolRewards = parseBoolEnv('PAYOUT_ROUTER_CLAIM_PROTOCOL_REWARDS', true);
  const processWeth = parseBoolEnv('PAYOUT_ROUTER_PROCESS_WETH', true);
  const allowExternalSwaps = parseBoolEnv('PAYOUT_ROUTER_ALLOW_EXTERNAL_SWAPS', false);
  const preferExternalSwaps = parseBoolEnv('PAYOUT_ROUTER_PREFER_EXTERNAL_SWAPS', false);
  const externalSwapSlippageBps = parseBpsEnv('PAYOUT_ROUTER_EXTERNAL_SWAP_SLIPPAGE_BPS', 100);

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
      ...zoraTokens.map((token) => ({ token, label: 'ZORA' as const, minCreatorOut: minCreatorOutZora })),
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

        let hasV3Path = true;
        if (token.label !== 'creatorCoin') {
          const path = await readContract<`0x${string}`>({
            address: payoutRouterAddress,
            abi: PAYOUT_ROUTER_ABI,
            functionName: 'swapPathToCreator',
            args: [token.token],
          });
          hasV3Path = Boolean(path && path !== '0x');
        }

        const shouldTryExternal =
          allowExternalSwaps && token.label !== 'creatorCoin' && (preferExternalSwaps || !hasV3Path);

        if (shouldTryExternal) {
          const quote = await fetchDefiLlamaExternalQuote({
            payoutRouterAddress,
            tokenIn: token.token,
            tokenOut: creatorCoin,
            amountIn: balance,
            slippageBps: externalSwapSlippageBps,
          });

          if (!quote || quote.error || quote.swapCallData === '0x') {
            if (!hasV3Path) {
              result.tokens.push({
                token: token.token,
                label: token.label,
                balance,
                converted: false,
                skippedReason: quote?.error ?? 'external_quote_unavailable',
              });
              continue;
            }
          } else {
            const [targetApproved, spenderApproved] = await Promise.all([
              readContract<boolean>({
                address: payoutRouterAddress,
                abi: PAYOUT_ROUTER_ABI,
                functionName: 'approvedExternalSwapTargets',
                args: [quote.swapTarget],
              }),
              readContract<boolean>({
                address: payoutRouterAddress,
                abi: PAYOUT_ROUTER_ABI,
                functionName: 'approvedExternalSwapSpenders',
                args: [quote.spender],
              }),
            ]);

            if (!targetApproved || !spenderApproved) {
              if (!hasV3Path) {
                result.tokens.push({
                  token: token.token,
                  label: token.label,
                  balance,
                  converted: false,
                  skippedReason: !targetApproved
                    ? `external_target_not_approved:${quote.swapTarget}`
                    : `external_spender_not_approved:${quote.spender}`,
                });
                continue;
              }
            } else {
              const externalConvertResult = await writeContract({
                address: payoutRouterAddress,
                abi: PAYOUT_ROUTER_ABI,
                functionName: 'convertViaExternalAndQueue',
                args: [
                  {
                    tokenIn: token.token,
                    amountIn: balance,
                    minCreatorOut: token.minCreatorOut,
                    spender: quote.spender,
                    swapTarget: quote.swapTarget,
                    swapCallData: quote.swapCallData,
                  },
                ],
              });

              result.tokens.push({
                token: token.token,
                label: token.label,
                balance,
                converted: externalConvertResult.success,
                route: 'external',
                txHash: externalConvertResult.success ? externalConvertResult.txHash : undefined,
                error: externalConvertResult.success ? undefined : externalConvertResult.error,
              });

              if (externalConvertResult.success) {
                batch.converted += 1;
                console.log(
                  `[${short(vault.vaultAddress)}] convertViaExternalAndQueue(${token.label}) succeeded; amount=${formatTokens(balance, token.label)}`,
                );
                continue;
              }

              if (!hasV3Path) {
                batch.errors += 1;
                continue;
              }
            }
          }
        }

        if (token.label !== 'creatorCoin' && !hasV3Path) {
          result.tokens.push({
            token: token.token,
            label: token.label,
            balance,
            converted: false,
            skippedReason: 'path_not_configured',
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
          route: 'v3',
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
