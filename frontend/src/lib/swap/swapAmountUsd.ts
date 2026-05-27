import { getAddress, isAddress } from 'viem'

import { CONTRACTS } from '@/config/contracts'
import { NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'

/** Uniswap-like fiat under swap amounts: full dollars with grouping, not $2.05K. */
const SWAP_USD_STANDARD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const SWAP_USD_SMALL = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
})

export function formatSwapUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '$0.00'
  if (value < 0.01) return SWAP_USD_SMALL.format(value)
  return SWAP_USD_STANDARD.format(value)
}

const BASE_USD_STABLECOINS = new Set(
  [
    CONTRACTS.usdc,
    '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT (Base)
  ].map((a) => a.toLowerCase()),
)

export type SwapUsdPriceContext = {
  ethUsd: number
  tokenUsdByAddress: ReadonlyMap<string, number>
}

function normalizeTokenAddress(address: string): string | null {
  const trimmed = typeof address === 'string' ? address.trim() : ''
  if (!trimmed) return null
  if (trimmed.toLowerCase() === NATIVE_TOKEN_ADDRESS) return NATIVE_TOKEN_ADDRESS
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed).toLowerCase()
}

export function parsePositiveHumanAmount(value: string): number | null {
  const trimmed = String(value ?? '').trim().replace(/,/g, '')
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function isUsdStablecoinToken(address: string): boolean {
  const normalized = normalizeTokenAddress(address)
  if (!normalized || normalized === NATIVE_TOKEN_ADDRESS) return false
  return BASE_USD_STABLECOINS.has(normalized)
}

export function isNativeEthToken(address: string): boolean {
  return normalizeTokenAddress(address) === NATIVE_TOKEN_ADDRESS
}

function humanAmountToUsd(
  humanAmount: number,
  tokenAddress: string,
  prices: SwapUsdPriceContext,
): number | null {
  if (!Number.isFinite(humanAmount) || humanAmount <= 0) return null

  const normalized = normalizeTokenAddress(tokenAddress)
  if (!normalized) return null

  if (isUsdStablecoinToken(normalized)) return humanAmount

  if (normalized === NATIVE_TOKEN_ADDRESS) {
    return prices.ethUsd > 0 ? humanAmount * prices.ethUsd : null
  }

  const tokenUsd = prices.tokenUsdByAddress.get(normalized)
  if (typeof tokenUsd === 'number' && Number.isFinite(tokenUsd) && tokenUsd > 0) {
    return humanAmount * tokenUsd
  }

  return null
}

export function deriveSwapUsdEstimates(params: {
  amountInUnits: string
  estimatedOut: string
  tokenIn: string
  tokenOut: string
  prices: SwapUsdPriceContext
}): { amountInUsd: string | null; estimatedOutUsd: string | null } {
  const amountIn = parsePositiveHumanAmount(params.amountInUnits)
  const amountOut = parsePositiveHumanAmount(params.estimatedOut)

  let sellUsd = amountIn != null ? humanAmountToUsd(amountIn, params.tokenIn, params.prices) : null
  let buyUsd = amountOut != null ? humanAmountToUsd(amountOut, params.tokenOut, params.prices) : null

  // Exact-input swaps: mirror sell USD to buy only when we have a positive output amount.
  if (sellUsd == null && buyUsd != null) sellUsd = buyUsd
  if (buyUsd == null && sellUsd != null && amountOut != null && amountOut > 0) buyUsd = sellUsd

  return {
    amountInUsd: sellUsd != null ? formatSwapUsd(sellUsd) : null,
    estimatedOutUsd: buyUsd != null ? formatSwapUsd(buyUsd) : null,
  }
}

export function collectSwapTokenPriceLookups(tokenIn: string, tokenOut: string): string[] {
  const out: string[] = []
  for (const raw of [tokenIn, tokenOut]) {
    const normalized = normalizeTokenAddress(raw)
    if (!normalized || normalized === NATIVE_TOKEN_ADDRESS) continue
    if (isUsdStablecoinToken(normalized)) continue
    out.push(normalized)
  }
  return Array.from(new Set(out))
}
