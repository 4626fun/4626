import { getAddress, isAddress, type Address, type Hex } from 'viem'

declare const process: { env: Record<string, string | undefined> }

/**
 * Quote-derived `minOut` for PayoutRouter V3 harvest swaps.
 *
 * Harvest executors must derive a net ShareOFT min-out from a Uniswap V3
 * QuoterV2 quote (after ShareOFT buy-fee haircut) and fail closed when no
 * quote and no explicit floor are available.
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

/** Default ShareOFT buy fee when pool (SwapOnly) sends to a non-exempt recipient. */
export const DEFAULT_SHARE_OFT_BUY_FEE_BPS = 690

/** CreatorShareOFT.OperationType.NoFees */
export const SHARE_OFT_OPERATION_NO_FEES = 2

export const SHARE_OFT_ADDRESS_TYPE_ABI = [
  {
    type: 'function',
    name: 'addressType',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
] as const

/** Haircut quoted ShareOFT output for the on-chain buy fee applied on DEX purchases. */
export function applyShareOftBuyFeeHaircut(amount: bigint, buyFeeBps = DEFAULT_SHARE_OFT_BUY_FEE_BPS): bigint {
  if (amount <= 0n || buyFeeBps <= 0) return amount > 0n ? amount : 0n
  const bps = BigInt(Math.min(Math.max(buyFeeBps, 0), 10_000))
  const net = (amount * (BPS_DENOMINATOR - bps)) / BPS_DENOMINATOR
  return net > 0n ? net : 0n
}

export async function resolveShareOftBuyFeeBpsForRecipient(params: {
  publicClient: { readContract: (args: Record<string, unknown>) => Promise<unknown> }
  shareOft: Address
  recipient: Address
  env?: Record<string, string | undefined>
}): Promise<number> {
  const env = params.env ?? process.env
  const rawOverride = String(env.PAYOUT_ROUTER_SHARE_OFT_BUY_FEE_BPS ?? '').trim()
  if (rawOverride) {
    const parsed = Number(rawOverride)
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000) {
      return parsed
    }
  }
  try {
    const opType = await params.publicClient.readContract({
      address: params.shareOft,
      abi: SHARE_OFT_ADDRESS_TYPE_ABI,
      functionName: 'addressType',
      args: [params.recipient],
    })
    if (Number(opType) === SHARE_OFT_OPERATION_NO_FEES) return 0
  } catch {
    // fall through to default buy fee for legacy routers
  }
  return DEFAULT_SHARE_OFT_BUY_FEE_BPS
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
  | { ok: true; minOut: bigint; source: 'quote' | 'quote+floor' | 'floor' }
  | { ok: false; reason: 'min_out_unavailable' }

/**
 * Resolve the min-out to use for a V3 `convertAndQueue` harvest swap.
 *
 * - Quote available: max(configured floor, quote minus slippage).
 * - Quote unavailable but explicit floor configured: use the floor.
 * - Neither: fail closed — the caller must skip the conversion.
 */
export async function resolveHarvestMinOut(params: {
  publicClient: QuoterReader
  path: Hex
  amountIn: bigint
  configuredMinOut: bigint
  env?: Record<string, string | undefined>
  shareOft?: Address
  payoutRouter?: Address
  shareOftBuyFeeBps?: number
}): Promise<HarvestMinOutResolution> {
  const env = params.env ?? process.env
  const quoted = await quoteV3PathOut({
    publicClient: params.publicClient,
    path: params.path,
    amountIn: params.amountIn,
    env,
  })

  const buyFeeBps =
    params.shareOftBuyFeeBps ??
    (params.shareOft && params.payoutRouter
      ? await resolveShareOftBuyFeeBpsForRecipient({
          publicClient: params.publicClient as { readContract: (args: Record<string, unknown>) => Promise<unknown> },
          shareOft: params.shareOft,
          recipient: params.payoutRouter,
          env,
        })
      : DEFAULT_SHARE_OFT_BUY_FEE_BPS)

  if (quoted !== null) {
    const afterBuyFee = applyShareOftBuyFeeHaircut(quoted, buyFeeBps)
    const derived = deriveMinOutFromQuote(afterBuyFee, resolvePayoutRouterV3SlippageBps(env))
    if (params.configuredMinOut > derived) {
      return { ok: true, minOut: params.configuredMinOut, source: 'quote+floor' }
    }
    return { ok: true, minOut: derived, source: 'quote' }
  }

  if (params.configuredMinOut > 0n) {
    return { ok: true, minOut: params.configuredMinOut, source: 'floor' }
  }

  return { ok: false, reason: 'min_out_unavailable' }
}
