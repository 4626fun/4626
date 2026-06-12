import { getAddress, isAddress, type Address, type Hex } from 'viem'

declare const process: { env: Record<string, string | undefined> }

/**
 * Quote-derived `minCreatorOut` for PayoutRouter V3 harvest swaps.
 *
 * The PayoutRouter contract only enforces `minCreatorOut > 0` on the external
 * aggregator route, not on the V3 `convertAndQueue` route. Harvest executors
 * previously defaulted min-out to 0 there, which makes large ZORA/WETH
 * conversions sandwichable. This module derives a min-out from a Uniswap V3
 * QuoterV2 quote over the router's stored swap path and fails closed (skip the
 * conversion) when no quote and no explicit floor are available.
 */

/** Canonical Uniswap V3 QuoterV2 on Base mainnet. */
const BASE_QUOTER_V2 = getAddress('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a')

const DEFAULT_V3_SLIPPAGE_BPS = 300
const MIN_SLIPPAGE_BPS = 1
const MAX_SLIPPAGE_BPS = 5_000
const BPS_DENOMINATOR = 10_000n

/**
 * QuoterV2.quoteExactInput is declared nonpayable on-chain but is designed to
 * be invoked via eth_call; declaring it `view` here lets viem readContract use it.
 */
export const QUOTER_V2_ABI = [
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
] as const

export type QuoterReader = {
  readContract: (args: {
    address: Address
    abi: typeof QUOTER_V2_ABI
    functionName: 'quoteExactInput'
    args: [Hex, bigint]
  }) => Promise<unknown>
}

export function resolvePayoutRouterV3SlippageBps(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = String(env.PAYOUT_ROUTER_V3_SLIPPAGE_BPS ?? '').trim()
  if (!raw) return DEFAULT_V3_SLIPPAGE_BPS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return DEFAULT_V3_SLIPPAGE_BPS
  if (parsed < MIN_SLIPPAGE_BPS || parsed > MAX_SLIPPAGE_BPS) return DEFAULT_V3_SLIPPAGE_BPS
  return parsed
}

export function resolvePayoutRouterQuoterAddress(
  env: Record<string, string | undefined> = process.env,
): Address {
  for (const key of ['PAYOUT_ROUTER_QUOTER_V2', 'QUOTER'] as const) {
    const raw = String(env[key] ?? '').trim()
    if (raw && isAddress(raw)) return getAddress(raw)
  }
  return BASE_QUOTER_V2
}

/** Apply slippage to a quoted output. Never returns 0 for a nonzero quote. */
export function deriveMinOutFromQuote(quotedOut: bigint, slippageBps: number): bigint {
  if (quotedOut <= 0n) return 0n
  const bps = BigInt(Math.min(Math.max(slippageBps, MIN_SLIPPAGE_BPS), MAX_SLIPPAGE_BPS))
  const derived = (quotedOut * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR
  return derived > 0n ? derived : 1n
}

export async function quoteV3PathOut(params: {
  publicClient: QuoterReader
  path: Hex
  amountIn: bigint
  env?: Record<string, string | undefined>
}): Promise<bigint | null> {
  if (!params.path || params.path === '0x' || params.amountIn <= 0n) return null
  try {
    const raw = await params.publicClient.readContract({
      address: resolvePayoutRouterQuoterAddress(params.env ?? process.env),
      abi: QUOTER_V2_ABI,
      functionName: 'quoteExactInput',
      args: [params.path, params.amountIn],
    })
    const amountOut = Array.isArray(raw) ? raw[0] : raw
    return typeof amountOut === 'bigint' && amountOut > 0n ? amountOut : null
  } catch {
    return null
  }
}

export type HarvestMinOutResolution =
  | { ok: true; minCreatorOut: bigint; source: 'quote' | 'quote+floor' | 'floor' }
  | { ok: false; reason: 'min_out_unavailable' }

/**
 * Resolve the min-out to use for a V3 `convertAndQueue` harvest swap.
 *
 * - Quote available: max(configured floor, quote minus slippage).
 * - Quote unavailable but explicit floor configured: use the floor.
 * - Neither: fail closed — the caller must skip the conversion.
 */
export async function resolveHarvestMinCreatorOut(params: {
  publicClient: QuoterReader
  path: Hex
  amountIn: bigint
  configuredMinOut: bigint
  env?: Record<string, string | undefined>
}): Promise<HarvestMinOutResolution> {
  const env = params.env ?? process.env
  const quoted = await quoteV3PathOut({
    publicClient: params.publicClient,
    path: params.path,
    amountIn: params.amountIn,
    env,
  })

  if (quoted !== null) {
    const derived = deriveMinOutFromQuote(quoted, resolvePayoutRouterV3SlippageBps(env))
    if (params.configuredMinOut > derived) {
      return { ok: true, minCreatorOut: params.configuredMinOut, source: 'quote+floor' }
    }
    return { ok: true, minCreatorOut: derived, source: 'quote' }
  }

  if (params.configuredMinOut > 0n) {
    return { ok: true, minCreatorOut: params.configuredMinOut, source: 'floor' }
  }

  return { ok: false, reason: 'min_out_unavailable' }
}
