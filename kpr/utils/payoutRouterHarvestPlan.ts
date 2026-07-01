/**
 * Plans PayoutRouter harvest conversions for a single `processBatch` call.
 */

import { readContract } from './onchain.js';
import {
  PAYOUT_ROUTER_HARVEST_ABI,
  directBatchAction,
  externalBatchAction,
  parseHarvestBoolEnv,
  parseHarvestBpsEnv,
  toProcessBatchArgs,
  type HarvestTokenPlanEntry,
  type PayoutRouterBatchAction,
  type PlannedHarvestConversion,
  type SkippedHarvestToken,
} from '../../shared/payout-router/harvestCommon.js';
import {
  applyShareOftBuyFeeHaircut,
  deriveMinOutFromQuote,
  resolveHarvestMinOut,
  resolveShareOftBuyFeeBpsForRecipient,
} from './payoutRouterMinOut.js';

export {
  PAYOUT_ROUTER_HARVEST_ABI,
  parseHarvestBoolEnv,
  parseHarvestBpsEnv,
  toProcessBatchArgs,
  type HarvestTokenPlanEntry,
  type PayoutRouterBatchAction,
  type PlannedHarvestConversion,
  type SkippedHarvestToken,
};

const DEFAULT_DEFILLAMA_API_BASE = 'https://api.llama.fi' as const;
const EXTERNAL_QUOTE_TIMEOUT_MS = 15_000;

export type HarvestPlanOptions = {
  payoutRouterAddress: `0x${string}`;
  shareOft: `0x${string}`;
  tokenPlan: HarvestTokenPlanEntry[];
  minBalance: bigint;
  allowExternalSwaps: boolean;
  preferExternalSwaps: boolean;
  externalSwapSlippageBps: number;
  resolveSwapPath?: (tokenIn: `0x${string}`) => Promise<`0x${string}`>;
};

type DefiLlamaExternalQuote = {
  swapTarget: `0x${string}`;
  spender: `0x${string}`;
  swapCallData: `0x${string}`;
  amountOut?: bigint;
  error?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHexData(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) && value !== '0x';
}

function normalizeAddressMaybe(value: string): `0x${string}` | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(raw)) return null;
  return raw as `0x${string}`;
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
  } catch (error: unknown) {
    const aborted = String((error as { name?: string })?.name ?? '').toLowerCase() === 'aborterror';
    return {
      status: aborted ? 504 : 502,
      payload: { error: aborted ? 'upstream_timeout' : String((error as Error)?.message ?? 'upstream_unreachable') },
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
  if (!to || !from || !isHexData(data)) return null;

  return { to, from, data, value: candidate.value == null ? '0' : String(candidate.value) };
}

function extractQuoteAmountOut(payload: Record<string, unknown>): bigint | undefined {
  const candidates: unknown[] = [
    payload.amountReturned,
    payload.outAmount,
    payload.toAmount,
    payload.buyAmount,
    isObject(payload.rawQuote) ? (payload.rawQuote as Record<string, unknown>).outAmount : undefined,
    isObject(payload.rawQuote) ? (payload.rawQuote as Record<string, unknown>).buyAmount : undefined,
  ];
  for (const candidate of candidates) {
    const raw = typeof candidate === 'number' ? String(Math.floor(candidate)) : String(candidate ?? '').trim();
    if (!/^\d+$/.test(raw)) continue;
    try {
      const parsed = BigInt(raw);
      if (parsed > 0n) return parsed;
    } catch {
      // keep scanning
    }
  }
  return undefined;
}

function readDefiLlamaApiBase(): string {
  const raw = String(process.env.DEFILLAMA_SWAP_API_BASE ?? '').trim();
  return raw ? raw.replace(/\/+$/, '') : DEFAULT_DEFILLAMA_API_BASE;
}

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
    return {
      swapTarget: params.payoutRouterAddress,
      spender: params.payoutRouterAddress,
      swapCallData: '0x',
      error: String((upstream.payload as { error?: string })?.error ?? `http_${upstream.status}`),
    };
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
    spender: spender ?? tx.to,
    swapCallData: tx.data,
    amountOut: extractQuoteAmountOut(payloadObj),
  };
}

async function readSwapPathFromRouter(
  payoutRouterAddress: `0x${string}`,
  tokenIn: `0x${string}`,
): Promise<`0x${string}`> {
  const path = await readContract<`0x${string}`>({
    address: payoutRouterAddress,
    abi: PAYOUT_ROUTER_HARVEST_ABI,
    functionName: 'swapPathToShareOFT',
    args: [tokenIn],
  });
  return path && path !== '0x' ? path : '0x';
}

export async function planPayoutRouterHarvestConversions(
  options: HarvestPlanOptions,
): Promise<{ conversions: PlannedHarvestConversion[]; skipped: SkippedHarvestToken[] }> {
  const conversions: PlannedHarvestConversion[] = [];
  const skipped: SkippedHarvestToken[] = [];
  const readPath = options.resolveSwapPath ?? ((tokenIn) => readSwapPathFromRouter(options.payoutRouterAddress, tokenIn));
  const shareOftBuyFeeBps = await resolveShareOftBuyFeeBpsForRecipient({
    shareOft: options.shareOft,
    recipient: options.payoutRouterAddress,
  });

  for (const token of options.tokenPlan) {
    const balance = await readContract<bigint>({
      address: token.token,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }],
        },
      ] as const,
      functionName: 'balanceOf',
      args: [options.payoutRouterAddress],
    });

    if (balance <= options.minBalance) {
      skipped.push({
        token: token.token,
        label: token.label,
        balance,
        skippedReason: 'balance_below_threshold',
      });
      continue;
    }

    if (token.label === 'creatorCoin') {
      conversions.push({
        token: token.token,
        label: token.label,
        balance,
        route: 'direct',
        action: directBatchAction(token.token, balance, 0n),
      });
      continue;
    }

    const v3Path = await readPath(token.token);
    const hasV3Path = Boolean(v3Path && v3Path !== '0x');
    const shouldTryExternal =
      options.allowExternalSwaps && (options.preferExternalSwaps || !hasV3Path);

    if (shouldTryExternal) {
      const quote = await fetchDefiLlamaExternalQuote({
        payoutRouterAddress: options.payoutRouterAddress,
        tokenIn: token.token,
        tokenOut: options.shareOft,
        amountIn: balance,
        slippageBps: options.externalSwapSlippageBps,
      });

      if (quote && !quote.error && quote.swapCallData !== '0x') {
        const [targetApproved, spenderApproved] = await Promise.all([
          readContract<boolean>({
            address: options.payoutRouterAddress,
            abi: PAYOUT_ROUTER_HARVEST_ABI,
            functionName: 'approvedExternalSwapTargets',
            args: [quote.swapTarget],
          }),
          readContract<boolean>({
            address: options.payoutRouterAddress,
            abi: PAYOUT_ROUTER_HARVEST_ABI,
            functionName: 'approvedExternalSwapSpenders',
            args: [quote.spender],
          }),
        ]);

        if (targetApproved && spenderApproved) {
          let externalMinOut = token.minOut;
          if (typeof quote.amountOut === 'bigint' && quote.amountOut > 0n) {
            const afterBuyFee = applyShareOftBuyFeeHaircut(quote.amountOut, shareOftBuyFeeBps);
            const derived = deriveMinOutFromQuote(afterBuyFee, options.externalSwapSlippageBps);
            if (derived > externalMinOut) externalMinOut = derived;
          }
          if (externalMinOut > 0n) {
            conversions.push({
              token: token.token,
              label: token.label,
              balance,
              route: 'external',
              action: externalBatchAction({
                tokenIn: token.token,
                amountIn: balance,
                minOut: externalMinOut,
                spender: quote.spender as `0x${string}`,
                swapTarget: quote.swapTarget as `0x${string}`,
                swapCallData: quote.swapCallData as `0x${string}`,
              }),
            });
            continue;
          }
          if (!hasV3Path) {
            skipped.push({
              token: token.token,
              label: token.label,
              balance,
              skippedReason: 'external_min_out_unavailable',
            });
            continue;
          }
        } else if (!hasV3Path) {
          skipped.push({
            token: token.token,
            label: token.label,
            balance,
            skippedReason: !targetApproved
              ? `external_target_not_approved:${quote.swapTarget}`
              : `external_spender_not_approved:${quote.spender}`,
          });
          continue;
        }
      } else if (!hasV3Path) {
        skipped.push({
          token: token.token,
          label: token.label,
          balance,
          skippedReason: quote?.error ?? 'external_quote_unavailable',
        });
        continue;
      }
    }

    if (!hasV3Path) {
      skipped.push({
        token: token.token,
        label: token.label,
        balance,
        skippedReason: 'path_not_configured',
      });
      continue;
    }

    const minOut = await resolveHarvestMinOut({
      path: v3Path,
      amountIn: balance,
      configuredMinOut: token.minOut,
      shareOft: options.shareOft,
      payoutRouter: options.payoutRouterAddress,
      shareOftBuyFeeBps,
    });
    if (!minOut.ok) {
      skipped.push({
        token: token.token,
        label: token.label,
        balance,
        skippedReason: minOut.reason,
      });
      continue;
    }

    conversions.push({
      token: token.token,
      label: token.label,
      balance,
      route: 'v3',
      action: directBatchAction(token.token, balance, minOut.minOut),
    });
  }

  return { conversions, skipped };
}
