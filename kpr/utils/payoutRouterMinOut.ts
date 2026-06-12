/**
 * Quote-derived `minCreatorOut` for PayoutRouter V3 harvest swaps (KPR lane).
 *
 * Mirrors frontend/server/_lib/onchain/payoutRouterMinOut.ts: the PayoutRouter
 * contract does not enforce min-out on the V3 `convertAndQueue` route, so the
 * keeper must never submit a conversion with min-out 0. Derive it from a
 * Uniswap V3 QuoterV2 quote over the router's stored swap path and fail closed
 * (skip the conversion) when no quote and no explicit env floor are available.
 */

import { getAddress, isAddress } from 'viem';
import { readContract } from './onchain.js';

/** Canonical Uniswap V3 QuoterV2 on Base mainnet. */
const BASE_QUOTER_V2 = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a');

const DEFAULT_V3_SLIPPAGE_BPS = 300;
const MIN_SLIPPAGE_BPS = 1;
const MAX_SLIPPAGE_BPS = 5_000;
const BPS_DENOMINATOR = 10_000n;

// QuoterV2.quoteExactInput is nonpayable on-chain but designed for eth_call;
// declared view here so viem readContract can use it.
const QUOTER_V2_ABI = [
  {
    type: 'function',
    name: 'quoteExactInput',
    stateMutability: 'view',
    inputs: [
      { name: 'path', type: 'bytes' },
      { name: 'amountIn', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96AfterList', type: 'uint160[]' },
      { name: 'initializedTicksCrossedList', type: 'uint32[]' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

export function resolvePayoutRouterV3SlippageBps(): number {
  const raw = String(process.env.PAYOUT_ROUTER_V3_SLIPPAGE_BPS ?? '').trim();
  if (!raw) return DEFAULT_V3_SLIPPAGE_BPS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return DEFAULT_V3_SLIPPAGE_BPS;
  if (parsed < MIN_SLIPPAGE_BPS || parsed > MAX_SLIPPAGE_BPS) return DEFAULT_V3_SLIPPAGE_BPS;
  return parsed;
}

function resolveQuoterAddress(): `0x${string}` {
  for (const key of ['PAYOUT_ROUTER_QUOTER_V2', 'QUOTER'] as const) {
    const raw = String(process.env[key] ?? '').trim();
    if (raw && isAddress(raw)) return getAddress(raw) as `0x${string}`;
  }
  return BASE_QUOTER_V2 as `0x${string}`;
}

/** Apply slippage to a quoted output. Never returns 0 for a nonzero quote. */
export function deriveMinOutFromQuote(quotedOut: bigint, slippageBps: number): bigint {
  if (quotedOut <= 0n) return 0n;
  const bps = BigInt(Math.min(Math.max(slippageBps, MIN_SLIPPAGE_BPS), MAX_SLIPPAGE_BPS));
  const derived = (quotedOut * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR;
  return derived > 0n ? derived : 1n;
}

export async function quoteV3PathOut(path: `0x${string}`, amountIn: bigint): Promise<bigint | null> {
  if (!path || path === '0x' || amountIn <= 0n) return null;
  try {
    const raw = await readContract<readonly [bigint, readonly bigint[], readonly number[], bigint]>({
      address: resolveQuoterAddress(),
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInput',
      args: [path, amountIn],
    });
    const amountOut = Array.isArray(raw) ? raw[0] : raw;
    return typeof amountOut === 'bigint' && amountOut > 0n ? amountOut : null;
  } catch {
    return null;
  }
}

export type HarvestMinOutResolution =
  | { ok: true; minCreatorOut: bigint; source: 'quote' | 'quote+floor' | 'floor' }
  | { ok: false; reason: 'min_out_unavailable' };

/**
 * Resolve the min-out to use for a V3 `convertAndQueue` harvest swap.
 *
 * - Quote available: max(configured floor, quote minus slippage).
 * - Quote unavailable but explicit floor configured: use the floor.
 * - Neither: fail closed — the caller must skip the conversion.
 */
export async function resolveHarvestMinCreatorOut(params: {
  path: `0x${string}`;
  amountIn: bigint;
  configuredMinOut: bigint;
}): Promise<HarvestMinOutResolution> {
  const quoted = await quoteV3PathOut(params.path, params.amountIn);

  if (quoted !== null) {
    const derived = deriveMinOutFromQuote(quoted, resolvePayoutRouterV3SlippageBps());
    if (params.configuredMinOut > derived) {
      return { ok: true, minCreatorOut: params.configuredMinOut, source: 'quote+floor' };
    }
    return { ok: true, minCreatorOut: derived, source: 'quote' };
  }

  if (params.configuredMinOut > 0n) {
    return { ok: true, minCreatorOut: params.configuredMinOut, source: 'floor' };
  }

  return { ok: false, reason: 'min_out_unavailable' };
}
