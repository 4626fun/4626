/**
 * Quote-derived `minOut` for PayoutRouter V3 harvest swaps (KPR lane).
 *
 * Mirrors frontend/server/_lib/onchain/payoutRouterMinOut.ts: harvest executors
 * must never submit a V3 conversion with min-out 0. Derive net ShareOFT min-out
 * from a
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

const DEFAULT_SHARE_OFT_BUY_FEE_BPS = 690;

/** CreatorShareOFT.OperationType.NoFees */
export const SHARE_OFT_OPERATION_NO_FEES = 2;

const SHARE_OFT_ADDRESS_TYPE_ABI = [
  {
    type: 'function',
    name: 'addressType',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
] as const;

export function applyShareOftBuyFeeHaircut(amount: bigint, buyFeeBps = DEFAULT_SHARE_OFT_BUY_FEE_BPS): bigint {
  if (amount <= 0n || buyFeeBps <= 0) return amount > 0n ? amount : 0n;
  const bps = BigInt(Math.min(Math.max(buyFeeBps, 0), 10_000));
  const net = (amount * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR;
  return net > 0n ? net : 0n;
}

export async function resolveShareOftBuyFeeBpsForRecipient(params: {
  shareOft: `0x${string}`;
  recipient: `0x${string}`;
}): Promise<number> {
  const rawOverride = String(process.env.PAYOUT_ROUTER_SHARE_OFT_BUY_FEE_BPS ?? '').trim();
  if (rawOverride) {
    const parsed = Number(rawOverride);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000) {
      return parsed;
    }
  }
  try {
    const opType = await readContract<number>({
      address: params.shareOft,
      abi: SHARE_OFT_ADDRESS_TYPE_ABI,
      functionName: 'addressType',
      args: [params.recipient],
    });
    if (Number(opType) === SHARE_OFT_OPERATION_NO_FEES) return 0;
  } catch {
    // legacy routers without NoFees
  }
  return DEFAULT_SHARE_OFT_BUY_FEE_BPS;
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
  | { ok: true; minOut: bigint; source: 'quote' | 'quote+floor' | 'floor' }
  | { ok: false; reason: 'min_out_unavailable' };

/**
 * Resolve the min-out to use for a V3 `convertAndQueue` harvest swap.
 *
 * - Quote available: max(configured floor, quote minus slippage).
 * - Quote unavailable but explicit floor configured: use the floor.
 * - Neither: fail closed — the caller must skip the conversion.
 */
export async function resolveHarvestMinOut(params: {
  path: `0x${string}`;
  amountIn: bigint;
  configuredMinOut: bigint;
  shareOft?: `0x${string}`;
  payoutRouter?: `0x${string}`;
  shareOftBuyFeeBps?: number;
}): Promise<HarvestMinOutResolution> {
  const quoted = await quoteV3PathOut(params.path, params.amountIn);

  const buyFeeBps =
    params.shareOftBuyFeeBps ??
    (params.shareOft && params.payoutRouter
      ? await resolveShareOftBuyFeeBpsForRecipient({
          shareOft: params.shareOft,
          recipient: params.payoutRouter,
        })
      : DEFAULT_SHARE_OFT_BUY_FEE_BPS);

  if (quoted !== null) {
    const afterBuyFee = applyShareOftBuyFeeHaircut(quoted, buyFeeBps);
    const derived = deriveMinOutFromQuote(afterBuyFee, resolvePayoutRouterV3SlippageBps());
    if (params.configuredMinOut > derived) {
      return { ok: true, minOut: params.configuredMinOut, source: 'quote+floor' };
    }
    return { ok: true, minOut: derived, source: 'quote' };
  }

  if (params.configuredMinOut > 0n) {
    return { ok: true, minOut: params.configuredMinOut, source: 'floor' };
  }

  return { ok: false, reason: 'min_out_unavailable' };
}
